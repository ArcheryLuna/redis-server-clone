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

export default function parseRDBFiles(Data: Map<string, DatabaseSchema>, Server: server) {
    const FilePath: string = path.join(Server.directory, Server.dbFilename);
    const buffer: Buffer = fs.readFileSync(FilePath);

    let offset: number = 0;

    // Parse header
    const MagicString = buffer.toString('ascii', 0, 5);
    const RedisVersion = buffer.toString('ascii', 5, 9);
    offset += 9; // Move past the header

    let RDBHeader: RedisRDBHeader = {
        magicString: MagicString,
        version: RedisVersion
    };

    const metadata: RedisMetadata = {};
    const databases: RedisDatabase[] = [];
    let currentDb: RedisDatabase | null = null;
    let expiry: number | undefined = undefined;

    function ReadLength(): { length: number, offsetDelta: number } {
        const FirstByte = buffer[offset];

        if ((FirstByte & 0xC0) === 0x00) {
            return { length: FirstByte & 0x3F, offsetDelta: 1 }
        }

        else if ((FirstByte & 0xC0) === 0x40) {
            return { length: ((FirstByte & 0x3F) << 8) | buffer[offset + 1], offsetDelta: 2 }
        }

        else if ((FirstByte & 0xC0) === 0x80) {
            return { length: buffer.readUInt32BE(offset + 1), offsetDelta: 5 }
        }

        else {
            throw new Error("Unsupported RDB length encoding")
        }
    }

    function ReadString(): string {
        const { length, offsetDelta } = ReadLength();
        offset += offsetDelta;
        const str = buffer.toString('utf8', offset, offset + length);
        offset += length;
        return str;
    }

    function readUInt32(): number {
        const value = buffer.readUInt32BE(offset);
        offset += 4;
        return value;
    }

    function ReadUInt64(): number {
        const high = buffer.readUInt32BE(offset);
        const low = buffer.readUInt32BE(offset + 4);

        offset += 8;

        return high * 2 ** 32 + low;
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

            const { length: expiryHashSize, offsetDelta: deltaTwo } = ReadLength;
            offset += deltaTwo;

            console.log(`Resized DB - Hash Table size ${dbHashSize}, expiry table size: ${expiryHashSize}`)
        }
        else if (opcode === EXPIRETIME) {
            const seconds = readUInt32();
            expiry = seconds * 1000;
        }
        else if (opcode === EXPIRETIMEMS) {
            expiry = ReadUInt64();
        }
        else if (opcode === STRING_ENCODING) {
            const key = ReadString();
            const value = ReadString();

            if (!currentDb) throw new Error("No DB Selected");

            currentDb.keyValues[key] = {
                value: value,
                ...(expiry !== undefined ? { expiration: expiry } : {})
            }

            expiry = undefined
        }
        else if (opcode === EOF) {
            break;
        } else {
            continue;
        }
    }

}

