import {
  AnchorError,
  LangErrorCode,
  LangErrorMessage,
} from "@project-serum/anchor";
import type { IdlErrorCode } from "@project-serum/anchor/dist/cjs/idl";
import type { PublicKey } from "@solana/web3.js";

export function formatAnchorError(err: AnchorError): IdlErrorCode {
  const {
    errorCode: { number, code },
    errorMessage,
  } = err.error;

  return {
    code: number,
    name: code,
    msg: errorMessage,
  };
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

export function getAnchorError(name: string): IdlErrorCode {
  const code = (LangErrorCode as Record<string, number>)[name];
  if (!code) throw new Error("Can't find code");
  const msg = LangErrorMessage.get(code);
  if (!msg) throw new Error("Can't find msg");
  return {
    code,
    name,
    msg,
  };
}
