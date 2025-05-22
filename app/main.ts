import * as net from "net";
import fs from "fs";
import path from "path";
import { RedisEntry, RDBConfig } from "./types";

import { parseCommandLineArgs } from "./utils/parseCommandLineArgs";
import { RESPEncoder } from "./utils/RESPEncoder";
import util from "util";

// Config JSON
import RDBConfigJson from "./configs/rdbconfig.json";
import parseRDBFile from "./utils/RDBFileDecoder";

// You can use print statements as follows for debugging, they'll be visible when running tests.
console.log("Logs from your program will appear here!");

export class server {
    private netServer: net.Server;
    private Commands: Map<
    string,
    {
        data: {
            name: string;
            description: string;
        };
        run: (
            connection: net.Socket,
            args: any[],
            Data: Map<string, RedisEntry>,
            Server: server,
        ) => void;
    }
    > = new Map();
    private Data: Map<string, RedisEntry> = new Map();
    private RedisDBConfig: RDBConfig = RDBConfigJson;

    public directory: string;
    public dbFilename: string;
    public isReplica: boolean;
    public replicaHost: string;
    public replicaPort: number;

    public RESPEncoder = RESPEncoder;

    private upstreamSocket?: net.Socket;

    constructor(directory: string, dbFilename: string, isReplica: boolean, replicaHost: string, replicaPort: number) {
        this.directory = directory;
        this.dbFilename = dbFilename;
        this.netServer = net.createServer((connection: net.Socket) =>
                                          this.handleConnection(connection),
                                         );
                                         this.isReplica = isReplica;
                                         this.replicaHost = replicaHost;
                                         this.replicaPort = replicaPort;
    }

    private PassiveDeletion() {
        const currentTime = Date.now();
        this.Data.forEach((entry, key) => {
            if (
                typeof entry.expiration === "number" &&
                entry.expiration < currentTime
            ) {
                this.Data.delete(key);
                console.log(`Deleted expired data for key: ${key}`);
            }
        });
    }

    async GetCommands(): Promise<void> {
        const CommandsDirectory = fs.readdirSync(`./app/commands/`);

        for (const Directory of CommandsDirectory) {
            const Files = fs
            .readdirSync(`./app/commands/${Directory}`)
            .filter((file) => file.endsWith(".ts"));

            for (const File of Files) {
                const modulePath = path.join(__dirname, `commands`, Directory, File);
                const commandModule = await import(modulePath);

                const command: {
                    data: {
                        name: string;
                        description: string;
                    };
                    run: (
                        connection: net.Socket,
                        args: any[],
                        Data: Map<string, DatabaseSchema>,
                        Server: server,
                    ) => void;
                } = commandModule.default || commandModule;

                this.Commands.set(command.data.name, command);

                console.log(
                    `✔ Initialized ${command.data.name} | ${new Date().toLocaleDateString()}`,
                );
            }
        }
    }

    private FetchCommand(cmd: string, connection: net.Socket) {
        const command = this.Commands.get(cmd);

        if (!command) {
            connection.write("-Error: Command not found\r\n");
            return;
        }

        return command;
    }

    private handleConnection(connection: net.Socket) {
        connection.on("data", (data: Object) => this.handleData(connection, data));
    }

    private handleData(connection: net.Socket, data: Object) {
        console.log(JSON.stringify(data.toString()));

        const ParsedData = data
        .toString()
        .split("\r\n")
        .filter(
            (line) => !line.startsWith("*") && !line.startsWith("$") && line !== "",
        );

            const commandName = ParsedData[0].toLowerCase();
            const args = ParsedData.slice(1);

            const command = this.FetchCommand(commandName, connection);

            if (command) {
                command.run(connection, args, this.Data, this);
                this.PassiveDeletion();
            } else {
                connection.write("-Error: Command not found\r\n");
            }
    }

    private debugPringData() {
        const rows = Array.from(this.Data.entries()).map(([key, entry]) => ({
            key,
            value:
                typeof entry.value === "string"
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

    private connectToMaster() {
        if (!this.isReplica) return;

        this.upstreamSocket = net.createConnection(
            { host: this.replicaHost, port: this.replicaPort },
            () => {
                console.log(`Connected to master at ${this.replicaHost}:${this.replicaPort}`);

                const pingPayload = "*1\r\n$4\r\nPING\r\n"

                this.upstreamSocket!.write(pingPayload);
            },
        );

        this.upstreamSocket.on("error", (err) => {
            console.error("Error connecting to master:", err);
        })

        this.upstreamSocket.on("close", () => {
            console.log("Connection to master closed. - Retrying in 5 seconds...");
            setTimeout(() => this.connectToMaster(), 5000);
        });
    }

    start(ipAddress: string, port: number) {
        parseRDBFile(this.Data, this);
        // this.debugPringData();
        // Listen to this server and port
        this.netServer.listen(port, ipAddress);
        // Send outputs to the replica server
        this.connectToMaster();
    }
}

export const options = parseCommandLineArgs();
const directory = options.dir || RDBConfigJson.dir;
const dbFilename = options.dbfilename || RDBConfigJson.dbfilename;
const port = Number(options.port) || 6379;
export const isReplica = Boolean(options.replicaof);

let replicaHost = "localhost";
let replicaPort = 6379;

// If the replica flag is set we need to check what the slave port and address are.
// If not set we will use the default values.

if (isReplica) {
    // Example input : ./your_program.sh --port 6380 --replicaof "localhost 6379"
    // We need to check if the text is "localhost:6379" or "localhost 6379" format
    const replicaOf = options.replicaof.includes(":")
        ? options.replicaof.split(":")
        : options.replicaof.split(" ");

        replicaHost = replicaOf[0];
        replicaPort = Number(replicaOf[1]);

        if (replicaHost && replicaPort) {
            console.log(`Replica of ${replicaHost} on port ${replicaPort}`);
        } else {
            console.error(
                "Invalid replicaof argument. Use 'host:port' or 'host port'.",
            );
            process.exit(1);
        }
}


fs.writeFileSync(
    "./app/configs/rdbconfig.json",
    `{
        "dir": "${directory}",
        "dbfilename": "${dbFilename}"
    }`,
);

const Server = new server(directory, dbFilename, isReplica, replicaHost, replicaPort);

Server.GetCommands().catch((error) => {
    console.error(error);
});

setTimeout(() => {
    Server.start("127.0.0.1", port);
}, 1000);
