import fs from "fs";
import { server } from "../main";
import path from "path";
import { DatabaseSchema } from "../types";

function ensureDirectoryExists(directoryName: string, file: string): void {
    if (!fs.existsSync(directoryName)) {
        fs.mkdirSync(directoryName, {recursive: true});
    }
}

function parseSizeEncoding(buffer: Buffer, offset: number): [number | bigint, number] {
    const firstByte = buffer[offset];
    const sizeEncodingType = firstByte >> 6;
    
    console.log(`firstByte: ${firstByte}, sizeEncodingType: ${sizeEncodingType}`); // Add this line

    let size;
    let bytesRead;

    switch(sizeEncodingType) {
        case 0x00:
            size = firstByte & 0x3F;
            bytesRead = 1;
            break;
        case 0x01:
            size = ((firstByte & 0x3F) << 8) | buffer[offset + 1];
            bytesRead = 2;
            break;
        case 0x02:
            size = buffer.readUInt32BE(offset + 1);
            bytesRead = 5;
            break;
        case 0x03:
            size = buffer.readBigUInt64BE(offset + 1); // BigInt for large size encoding
            bytesRead = 9; // Adjust bytes read for 64-bit size
            break;
        default:
            throw new Error("Unsuported size encoding");
    }

    return [size, bytesRead];
}


function parseStringEncoding(buffer: Buffer, offset: number): [string, number] {
    const [ size, sizeBytes ] = parseSizeEncoding(buffer, offset);
    const start = offset + sizeBytes;
    const end = (typeof size === 'bigint') ? start + Number(size) : start + size;
    const str = buffer.slice(start, end).toString("utf-8");

    return [str, sizeBytes + Number(size)]
}

function getRDBFiles(Server: server, Data: Map<string, DatabaseSchema>) {
    const directoryName = Server.directory;
    const fileName = Server.dbFilename;

    const filePath = path.join(directoryName, fileName);

    if(!fs.existsSync(filePath)) {
        console.log("RDB file does not exist, Starting with an empty database.");
        return;
    }

    const rdbBuffer = fs.readFileSync(filePath);
    let offset = 0;

    // To skip Magic String && the version number
    offset += 9

    while ( offset < rdbBuffer.length ) {
        const opcode = rdbBuffer[offset];

        offset += 1;

        if (opcode === 0xFE) {
            const [dbIndex, dbBytesRead ] = parseSizeEncoding(rdbBuffer, offset);
            offset += dbBytesRead;
        } else if ( opcode === 0xFB) {
            const [ mainHashtableSize, mainBytesRead ] = parseSizeEncoding(rdbBuffer, offset);
            offset += mainBytesRead;
            const [ expiresHashTableSize, exipresBytesRead ] = parseSizeEncoding(rdbBuffer, offset);
            offset += exipresBytesRead;
        } else if ( opcode ===  0x00) {
            const [ key, keyBytesRead ] = parseStringEncoding(rdbBuffer, offset);
            offset += keyBytesRead;
            const [ value, valueBytesRead ] = parseStringEncoding(rdbBuffer, offset);
            offset += valueBytesRead;

            Data.set(key, { key, value, expire: 0})
        } else if ( opcode ===  0xFD || opcode === 0xFC) {
            let expire;
            if (opcode === 0xFD) {
                expire = rdbBuffer.readUint32LE(offset);
                offset += 4;
            } else {
                expire = rdbBuffer.readBigUInt64LE(offset);
                offset += 8;
            }

            const [ key, keyBytesRead ] = parseStringEncoding(rdbBuffer, offset);
            offset += keyBytesRead;
            const [ value, valueBytesRead ] = parseStringEncoding(rdbBuffer, offset);
            offset += valueBytesRead;

            Data.set(key, {key, value, expire: Number(expire)});
        } else if ( opcode ===  0xFF) {
            // End of file
            break;
        } else if ( opcode === 0xFA) {
            const [ _, metaBytesRead ] = parseStringEncoding(rdbBuffer, offset);
            offset += metaBytesRead
            const [ __, valueBytesRead ] = parseStringEncoding(rdbBuffer, offset);
            offset += valueBytesRead;
        } else {
            throw new Error(`Unknown RDB Opcode: ${opcode}`);
        }
    }
}

function createRDBFile(Server: server, content?: Buffer): boolean {
    const directoryName = Server.directory;
    const fileName = Server.dbFilename;

    ensureDirectoryExists(directoryName, fileName);

    try {
        const filePath = path.join(directoryName, `${fileName}`)

        const magicString = Buffer.from("REDIS");
        const version = Buffer.from("0001");
        const rdbHeader = Buffer.concat([magicString, version]);

        const rdbContent = content ? Buffer.concat([rdbHeader, content]) : rdbHeader;

        fs.writeFileSync(filePath, rdbContent, { flag : "wx"})
        return true;
    } catch ( error ) {
        console.error(`Error creating the RDB file: ${error}`);
        return false;
    }
}

function updateRDBFile(Server: server, content: Buffer): boolean {
    const directoryName = Server.directory;
    const fileName = Server.dbFilename;

    ensureDirectoryExists(directoryName, fileName);

    try {
        const filePath = path.join(directoryName, `${fileName}`);

        if(!fs.existsSync(filePath)) {
            createRDBFile(Server, content);
        }

        fs.appendFileSync(filePath, content);

        return true;
    } catch ( error ) {
        console.error(`Error updating the RDB file: ${error}`);
        return false;
    }
}

function deleteRDBFile(Server: server): boolean {
    const directoryName = Server.directory;
    const fileName = Server.dbFilename;

    ensureDirectoryExists(directoryName, fileName);

    try {
        const filePath = path.join(directoryName, `${fileName}`);

        fs.unlinkSync(filePath);
        return true;
    } catch ( error ) {
        console.error(`Error deleting the RDB file: ${error}`);
        return false;
    }
}


export default { getRDBFiles, createRDBFile, updateRDBFile, deleteRDBFile, ensureDirectoryExists }