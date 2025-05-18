import * as net from "net";
import fs from "fs"
import path from "path";
import { RedisEntry, RDBConfig } from "./types";

import { parseCommandLineArgs } from "./utils/parseCommandLineArgs";
import { RESPEncoder } from "./utils/RESPEncoder";
import util from "util"

// Config JSON
import RDBConfigJson from "./configs/rdbconfig.json";
import parseRDBFile from "./utils/RDBFileDecoder";

// You can use print statements as follows for debugging, they'll be visible when running tests.
console.log("Logs from your program will appear here!");

export class server {

    private netServer: net.Server
    private Commands: Map<string, {
        data: {
            name: string,
            description: string
        },
        run: (connection: net.Socket, args: any[], Data: Map<string, RedisEntry>, Server: server) => void
    }> = new Map();
    private Data: Map<string, RedisEntry> = new Map();
    private RedisDBConfig: RDBConfig = RDBConfigJson;

    public directory: string;
    public dbFilename: string;

    public RESPEncoder = RESPEncoder;

    constructor(directory: string, dbFilename: string, port: number, host: string) {
        this.directory = directory;
        this.dbFilename = dbFilename;
        this.networkPort = port;
        this.networkHost = host;

        this.netServer = net.createServer((connection: net.Socket) => this.handleConnection(connection))
    }

    private PassiveDeletion() {
        const currentTime = Date.now();
        this.Data.forEach((entry, key) => {
            if (typeof entry.expiration === 'number' && entry.expiration < currentTime) {
                this.Data.delete(key);
                console.log(`Deleted expired data for key: ${key}`);
            }
        });
    }

    async GetCommands(): Promise<void> {
        const CommandsDirectory = fs.readdirSync(`./app/commands/`)

        for (const Directory of CommandsDirectory) {
            const Files = fs.readdirSync(`./app/commands/${Directory}`)
                .filter((file) => file.endsWith(".ts"));

            for (const File of Files) {
                const modulePath = path.join(__dirname, `commands`, Directory, File);
                const commandModule = await import(modulePath);

                const command: {
                    data: {
                        name: string,
                        description: string
                    },
                    run: (connection: net.Socket, args: any[], Data: Map<string, DatabaseSchema>, Server: server) => void
                } = commandModule.default || commandModule;

                this.Commands.set(command.data.name, command)

                console.log(`✔ Initialized ${command.data.name} | ${new Date().toLocaleDateString()}`)
            }
        }
    }

    private FetchCommand(cmd: string, connection: net.Socket) {
        const command = this.Commands.get(cmd);

        if (!command) {
            connection.write("-Error: Command not found\r\n");
            return;
        }

        return command
    }

    private handleConnection(connection: net.Socket) {
        connection.on("data", (data: Object) => this.handleData(connection, data))
    }

    private handleData(connection: net.Socket, data: Object) {
        console.log(JSON.stringify(data.toString()));

        const ParsedData = data.toString().split("\r\n").filter((line) =>
            !line.startsWith("*") &&
            !line.startsWith("$") &&
            line !== ""
        );

        const commandName = ParsedData[0].toLowerCase();
        const args = ParsedData.slice(1);

        const command = this.FetchCommand(commandName, connection);

        if (command) {
            command.run(connection, args, this.Data, this);
            this.PassiveDeletion();
        } else {
            connection.write("-Error: Command not found\r\n")
        }
    }

    private debugPringData() {
        const rows = Array.from(this.Data.entries()).map(([key, entry]) => ({
            key,
            value: typeof entry.value === "string"
                ? entry.value
                : util.inspect(entry.value, { depth: 1, breakLength: 20 }),
            expiration: entry.expiration
                ? new Date(entry.expiration).toISOString()
                : "N/A",
        }));
        console.log("\n=== In-memory database snapshot ===");
        console.table(rows);
        console.log("====================================\n");
    }


    start() {
        parseRDBFile(this.Data, this)
        // this.debugPringData();
        this.netServer.listen(this.networkPort, this.networkHost);
    }
}

const options = parseCommandLineArgs();
const directory = options.dir || RDBConfigJson.dir;
const dbFilename = options.dbfilename || RDBConfigJson.dbfilename;
const port = Number(options.port) || 6379;
const host = options.host || "127.0.0.1";

fs.writeFileSync("./app/configs/rdbconfig.json", `{
    "dir": "${directory}",
    "dbfilename": "${dbFilename}"
}`)

const Server = new server(directory, dbFilename, port, host);
Server.GetCommands().catch(error => {
    console.error(error);
});

setTimeout(() => {
    Server.start();
}, 1000)

