import { server } from "../main";
import fs from "fs"
import path from "path";

import { DatabaseSchema, RedisEntry, RedisValue } from "../types";

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

export default function parseRDBFiles(Data: Map<string, DatabaseSchema>, Server: server) {
    const FilePath: string = path.join(Server.directory, Server.dbFilename);
    const FileBuffer: Buffer = fs.readFileSync(FilePath);

    console.log(FileBuffer);

    let offset = 0;

    // Parsing the header section
    const magicString = FileBuffer.toString('ascii', offset, offset + 5);
    offset += 5;

    const version = FileBuffer.toString("ascii", offset, offset + 4);
    offset += 4;

    const Header: RedisRDBHeader = {
        magicString,
        version,
    };

    const metadata: RedisMetadata = {};

    // Parsing the metadata section
    while (FileBuffer[offset] === 0xFA) {
        offset++;
        const nameLength = FileBuffer[offset];
        offset++;
        const name = FileBuffer.toString('ascii', offset, offset + nameLength);
        offset += nameLength;

        const valueLength = FileBuffer[offset];
        offset++;
        const value = FileBuffer.toString('ascii', offset, offset + valueLength);
        offset += valueLength;

        // Add only valid metadata entries
        if (name && value) {
            metadata[name] = value;
        } else {
            console.warn(`Unexpected metadata entry at offset ${offset - (nameLength + valueLength + 2)}`);
        }
    }

    // Parsing the database section
    while (FileBuffer[offset] === 0xFE) {
        offset++; // Skip the FE byte

        const dbIndex = FileBuffer[offset];
        offset++;

        const dbName = `db${dbIndex}`;
        let dbData = Data.get(dbName);

        if (!dbData) {
            dbData = {};
            Data.set(dbName, dbData);
        }

        while (FileBuffer[offset] !== 0xFF && FileBuffer[offset] !== 0xFE) {
            const flag = FileBuffer[offset];
            offset++;

            const keyLength = FileBuffer[offset];
            offset++;
            const key = FileBuffer.toString('ascii', offset, offset + keyLength);
            offset += keyLength;

            const valueLength = FileBuffer[offset];
            offset++;
            const value = FileBuffer.toString('ascii', offset, offset + valueLength);
            offset += valueLength;

            const redisEntry: RedisEntry = {
                value: value as RedisValue,
            };

            dbData[key] = redisEntry;
        }
    }

    // Parsing checksum
    const checksum = FileBuffer.slice(offset + 1).toString('hex');

    console.log("RDB file parsed successfully:", {
        Header,
        metadata,
        checksum,
    });
}
