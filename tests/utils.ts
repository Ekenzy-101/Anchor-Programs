import type { AnchorError } from "@project-serum/anchor";
import type { IdlErrorCode } from "@project-serum/anchor/dist/cjs/idl";
import type { PublicKey } from "@solana/web3.js";

export function formatAnchorError(err: AnchorError) {
  const {
    errorCode: { number, code },
    errorMessage,
  } = err.error;

  return {
    code: number,
    name: code,
    msg: errorMessage,
  } as IdlErrorCode;
}

export function mapKeysToUint8Array(publicKeys: PublicKey[]): Uint8Array {
  let result: number[] = [];
  publicKeys.forEach((key) => {
    for (const byte of key.toBytes().subarray(0, 16).values()) {
      result.push(byte);
    }
  });

  return Uint8Array.from(result);
}
