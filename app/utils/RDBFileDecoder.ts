import { server } from "../main";
import fs from "fs";
import path from "path";

import { RedisEntry, DatabaseSchema, RedisValue, RedisList, RedisSet, RedisSortedSet, RedisHash } from "../types";

type RedisRDBHeader = {
    magicString: string;
    version: string;
};

type RedisMetadata = {
    [key: string]: string;
};

type RedisDatabase = {
    index: number;
    keyValues: { [key: string]: RedisEntry };
};

type RedisRDBFile = {
    header: RedisRDBHeader;
    metadata: RedisMetadata;
    databases: RedisDatabase[];
    checksum: string;
};

// Constants for RDB opcodes
const EOF = 0xFF;
const SELECTDB = 0xFE;
const EXPIRETIME = 0xFD;
const EXPIRETIMEMS = 0xFC;
const RESIZEDB = 0xFB;
const AUX = 0xFA;
const STRING_ENCODING = 0x00;

export default function parseRDBFiles(Data: Map<string, RedisEntry>, Server: server) {
    const FilePath: string = path.join(Server.directory, Server.dbFilename);

    if (!fs.existsSync(FilePath)) {
        console.warn(
            `[RDB LOADER] No file at ${FilePath}. Continuing with an empty DB`
        );
        Data.clear();
        return;
    }

    const buffer: Buffer = fs.readFileSync(FilePath);

    let offset: number = 0;

    // Parse header
    const MagicString = buffer.toString('ascii', 0, 5);
    const RedisVersion = buffer.toString('ascii', 5, 9);
    offset += 9; // Move past the header
    Data.clear();

    let RDBHeader: RedisRDBHeader = {
        magicString: MagicString,
        version: RedisVersion
    };

    const metadata: RedisMetadata = {};
    const databases: RedisDatabase[] = [];
    let currentDb: RedisDatabase | null = null;
    let expiry: number | undefined = undefined;

    function readUInt32(): number {
        const value = buffer.readUInt32BE(offset);
        offset += 4;
        return value;
    }

    function ReadUInt64LE(buf: Buffer, offset: number): number {
        const low = buf.readUInt32LE(offset);
        const high = buf.readUInt32LE(offset + 4);
        return high * 4294967296 + low;
    }

    function ReadUInt64(): number {
        const high = buffer.readUInt32BE(offset);
        const low = buffer.readUInt32BE(offset + 4);
        offset += 8;
        return high * 2 ** 32 + low;
    }

    function ReadString(): string {
        const first = buffer[offset];

        // ── Plain lengths ────────────────────────────────────────────
        if ((first & 0xC0) === 0x00) {                 // 6-bit
            const len = first & 0x3F;
            offset += 1;
            const str = buffer.toString("utf8", offset, offset + len);
            offset += len;
            return str;
        }
        if ((first & 0xC0) === 0x40) {                 // 14-bit
            const len = ((first & 0x3F) << 8) | buffer[offset + 1];
            offset += 2;
            const str = buffer.toString("utf8", offset, offset + len);
            offset += len;
            return str;
        }
        if ((first & 0xC0) === 0x80) {                 // 32-bit
            const len = buffer.readUInt32BE(offset + 1);
            offset += 5;
            const str = buffer.toString("utf8", offset, offset + len);
            offset += len;
            return str;
        }

        // ── Encoded value (0b11xxxxxx) ───────────────────────────────
        if ((first & 0xC0) === 0xC0) {
            const encType = first & 0x3F;
            offset += 1;

            // Integer-encoded strings
            if (encType === 0) {         // INT8
                const v = buffer.readInt8(offset);
                offset += 1;
                return v.toString();
            }
            if (encType === 1) {         // INT16
                const v = buffer.readInt16BE(offset);
                offset += 2;
                return v.toString();
            }
            if (encType === 2) {         // INT32
                const v = buffer.readInt32BE(offset);
                offset += 4;
                return v.toString();
            }

            // LZF compression (encType === 3)
            // Read <compressed len> and <original len>, then skip the bytes.
            const { length: clen, offsetDelta: d1 } = readLength();
            offset += d1;
            const { length: ulen, offsetDelta: d2 } = readLength();
            offset += d2;

            const slice = buffer.slice(offset, offset + clen);
            offset += clen;

            // We don’t need LZF for the current stages – just return placeholder.
            return `<lzf ${clen}b → ${ulen}b>`;
        }

        throw new Error("Unsupported RDB length encoding");
    }

    /**
     * Original length decoder (unchanged) – still used by readString()
     * for the 6/14/32-bit cases, and by the LZF branch.
     */
    function ReadLength(): { length: number; offsetDelta: number } {
        const first = buffer[offset];

        if ((first & 0xC0) === 0x00) {
            return { length: first & 0x3F, offsetDelta: 1 };
        }
        if ((first & 0xC0) === 0x40) {
            return {
                length: ((first & 0x3F) << 8) | buffer[offset + 1],
                offsetDelta: 2,
            };
        }
        if ((first & 0xC0) === 0x80) {
            return { length: buffer.readUInt32BE(offset + 1), offsetDelta: 5 };
        }

        // Anything else will be handled directly in readString()
        throw new Error("readLength() called on encoded value");
    }

    while (offset < buffer.length) {
        const opcode = buffer[offset++];

        if (opcode === AUX) {
            const key = ReadString();
            const value = ReadString();
            metadata[key] = value;
        }
        else if (opcode === SELECTDB) {
            const { length: dbIndex, offsetDelta } = ReadLength();
            offset += offsetDelta;

            currentDb = {
                index: dbIndex,
                keyValues: {}
            };

            databases.push(currentDb);
        }
        else if (opcode === RESIZEDB) {
            const { length: dbHashSize, offsetDelta: deltaOne } = ReadLength();
            offset += deltaOne;

            const { length: expiryHashSize, offsetDelta: deltaTwo } = ReadLength();
            offset += deltaTwo;

            console.log(`Resized DB - Hash Table size ${dbHashSize}, expiry table size: ${expiryHashSize}`)
        }
        else if (opcode === EXPIRETIME) {
            const seconds = readUInt32();
            expiry = seconds * 1000;
        }
        else if (opcode === EXPIRETIMEMS) {
            expiry = ReadUInt64LE(buffer, offset);
            offset += 8;
        }
        else if (opcode === STRING_ENCODING) {
            const key = ReadString();
            const value = ReadString();

            if (!currentDb) throw new Error("No DB Selected");

            const entry: RedisEntry = {
                value,
                ...(expiry !== undefined ? { expiration: expiry } : {})
            };

            currentDb.keyValues[key] = entry;    // keep per-DB structure (future use)
            Data.set(key, entry);                // ← make it live for commands **now**

            expiry = undefined;
        }

        else if (opcode === EOF) {
            break;
        } else {
            continue;
        }
    }

    for (const db of databases) {
        for (const [key, entry] of Object.entries(db.keyValues)) {
            Data.set(key, entry);
        }
    }

}

