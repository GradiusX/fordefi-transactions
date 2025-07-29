import * as crypto from 'crypto';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import fetch from 'node-fetch';

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
const privateKeyFile = 'private.pem';
const gatewayHost = 'api.fordefi.com';
const path = '/api/v1/transactions';
const tx_note = 'Black box test';

// -- Encode payload as base64 (from JSON or default 32 bytes)
function buildPayload(payload?: unknown): string {
  if (payload === undefined) {
    const payloadBytes = Buffer.alloc(32, 0);
    return payloadBytes.toString('base64');
  }
  const json = JSON.stringify(payload);
  return Buffer.from(json, 'utf8').toString('base64');
}

// -- Sign the payload using ECDSA (PEM key, SHA256)
function signPayload(timestamp: number, requestBody: string): string {
  const payload = `${path}|${timestamp}|${requestBody}`;
  const secretPem = fs.readFileSync(privateKeyFile, 'utf8');
  const privateKey = crypto.createPrivateKey(secretPem);

  const sign = crypto.createSign('SHA256');
  sign.update(payload, 'utf8');
  sign.end();

  return sign.sign(privateKey).toString('base64');
}

// -- Send the black box signing request
async function sendBlackBoxSignatureRequest(jsonPayload?: unknown) {
  const timestamp = Math.floor(Date.now() / 1000);
  const payloadEncoded = buildPayload(jsonPayload);

  const requestJson = {
    vault_id,
    note: tx_note,
    signer_type: 'api_signer',
    type: 'black_box_signature',
    details: {
      format: 'hash_binary',
      hash_binary: payloadEncoded,
    },
  };

  const requestBody = JSON.stringify(requestJson);
  const signature = signPayload(timestamp, requestBody);

  const response = await fetch(`https://${gatewayHost}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
      'X-Timestamp': timestamp.toString(),
      'X-Signature': signature,
    },
    body: requestBody,
  });

  const result = await response.json();
  console.log('Black box signature response:', result);
  return result;
}

let payload = '{"foo":"bar","amount":123}'
const parsed = payload ? JSON.parse(payload) : undefined;
sendBlackBoxSignatureRequest(parsed).catch((err) => console.error('Error:', err));