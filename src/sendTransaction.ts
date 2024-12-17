import * as crypto from 'crypto';
import * as fs from 'fs';
import { SuiClient } from '@mysten/sui/client'
import { Transaction as TransactionBlock } from "@mysten/sui/transactions";

const client = new SuiClient({ url: "https://fullnode.mainnet.sui.io:443" });

const vault_id = "<vault_id>"
const vault_address = "<vault_address>"
const tx_note = "<note>"
const accessToken: string = "<Enter API User access token>";
const privateKeyFile: string = "private.pem";

const gatewayHost: string = "api.fordefi.com";
const path: string = "/api/v1/transactions";


// construct tx block
async function buildTransactionBlock(){
    const tx = new TransactionBlock();
    // This is the address of the vault used to create this transaction
    tx.setSender(vault_address);
    tx.setGasBudget(1000000);
    tx.setGasPrice(1000);
    /*
        Add TX BLOCK STUFF
    */

    const bcsData = await tx.build({ client });
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