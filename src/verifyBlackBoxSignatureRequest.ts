import * as dotenv from 'dotenv';
import fetch from 'node-fetch';
import * as nacl from 'tweetnacl';

dotenv.config();

function getEnvVar(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value;
}

const vault_id = getEnvVar('VAULT_ID');
const accessToken = getEnvVar('ACCESS_TOKEN');
const gatewayHost = 'api.fordefi.com';

// Types
interface TransactionResponse {
  id: string;
  details: {
    signature: string;
  };
}

interface VaultResponse {
  public_key_compressed: string;
}

function base64Decode(str: string): Buffer {
  return Buffer.from(str, 'base64');
}

// Main function
async function verifyBlackBoxSignature(transactionId: string, originalPayload: unknown) {
  const payloadBytes = Buffer.from(JSON.stringify(originalPayload), 'utf8');

  const transactionResp = await fetch(`https://${gatewayHost}/api/v1/transactions/${transactionId}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });
  const transactionJson = (await transactionResp.json()) as TransactionResponse;
  const signatureB64 = transactionJson.details.signature;
  const signatureBytes = base64Decode(signatureB64);

  const vaultResp = await fetch(`https://${gatewayHost}/api/v1/vaults/${vault_id}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  const vaultJson = (await vaultResp.json()) as VaultResponse;
  const publicKeyBytes = base64Decode(vaultJson.public_key_compressed);

  const isValid = nacl.sign.detached.verify(
    payloadBytes,
    signatureBytes,
    publicKeyBytes
  );

  if (isValid) {
    console.log('✅ Signature is valid');
  } else {
    console.error('❌ Signature is invalid');
  }
}

// use the transactionId received from sending the request
const transactionId = "b72db88e-93f5-4947-8049-7a910421e056"
// make sure the payload is the same
const rawPayload = '{"foo":"bar","amount":123}'

try {
  const parsedPayload = JSON.parse(rawPayload);
  verifyBlackBoxSignature(transactionId, parsedPayload);
} catch (err) {
  console.error('Failed to parse payload or verify signature:', err);
}
