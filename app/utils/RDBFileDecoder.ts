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

export default function parseRDBFiles(Data: Map<string, DatabaseSchema>, Server: server) {
    const FilePath: string = path.join(Server.directory, Server.dbFilename);
    const buffer: Buffer = fs.readFileSync(FilePath);

    let offset = 0;

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


}
