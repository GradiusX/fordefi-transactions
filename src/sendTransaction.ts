import * as crypto from 'crypto';
import * as fs from 'fs';
import { CoinUtils, TransactionBlock, SuiClient } from "@firefly-exchange/library-sui";
import * as dotenv from 'dotenv';
dotenv.config();

const client = new SuiClient({ url: "https://fullnode.mainnet.sui.io:443" });

function getEnvVar(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value;
}

const vault_id = getEnvVar('VAULT_ID')
const vault_address = getEnvVar('VAULT_ADDRESS')
const tx_note = "Test note"
const accessToken: string = getEnvVar('ACCESS_TOKEN')
const privateKeyFile: string = "private.pem";

const gatewayHost: string = "api.fordefi.com";
const path: string = "/api/v1/transactions";


// construct tx block
async function buildTransactionBlock(){
    let txb = new TransactionBlock();
    txb.setSender(vault_address);
    txb.setGasBudget(50000000);
    txb.setGasPrice(5000);
    txb = await CoinUtils.createTransferCoinTransaction(txb, client, 0.1e9, "0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI", "0xba87b07e98755d5e7853a3b8116e1de9a50cf02acc55fc4f6e98db5026b666e0", vault_address);
    // txb.splitCoins(txb.gas, [txb.pure.u64(toBigNumberStr(1, 9))])

    const bcsData = await txb.build({ client });
    return Buffer.from(bcsData).toString("base64");
}

async function signPayload(timestamp: number, requestBody: string){
    const payload: string = `${path}|${timestamp}|${requestBody}`;

    // Read and create the private key
    const secretPem: string = fs.readFileSync(privateKeyFile, 'utf8');
    const privateKey: crypto.KeyObject = crypto.createPrivateKey(secretPem);

    // Sign the payload
    const sign: crypto.Sign = crypto.createSign('SHA256');
    sign.update(payload, 'utf8');
    sign.end();
    return sign.sign(privateKey, 'base64');
}

async function sendRequest(){
    const timestamp: number = new Date().getTime();

    const requestJson: Record<string, any> = {
        "signer_type": "api_signer",
        "type": "sui_transaction",
        "details": {
            "type": "sui_binary_canonical_serialization",
            "chain": "sui_mainnet",
            "data": await buildTransactionBlock()
        },
        "note": tx_note,
        "vault_id": vault_id
    }
    const requestBody = JSON.stringify(requestJson)

    // Perform the request
    fetch(`https://${gatewayHost}${path}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
            'X-Timestamp': timestamp.toString(),
            'X-Signature': await signPayload(timestamp, requestBody),
        },
        body: requestBody
    })
        .then((response) => response.text())
        .then((json) => console.log(json))
        .catch((error) => console.error("Error:", error));
}

sendRequest()
    .then((resp) => console.log(resp))
    .catch((err) => console.error("Error:", err));