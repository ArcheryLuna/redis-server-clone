import * as net from "net";
import fs from "fs"
import path from "path";
import { DatabaseSchema, RDBConfig } from "./types";
import { parseCommandLineArgs } from "./utils/parseCommandLineArgs";
import { RESPEncoder } from "./utils/RESPEncoder";

import RDBFileLogic from "./utils/RDBFileLogic";

// Config JSON
import RDBConfigJson from "./configs/rdbconfig.json";

// You can use print statements as follows for debugging, they'll be visible when running tests.
console.log("Logs from your program will appear here!");

// Uncomment this block to pass the first stage

export class server {
    
    private netServer: net.Server
    private Commands: Map<string, {
        data: {
            name: string,
            description: string
        },
        run: (connection: net.Socket, args: any[], Data: Map<string, DatabaseSchema>, Server: server) =>  void
    }> = new Map();
    private Data: Map<string, DatabaseSchema> = new Map();
    private RedisDBConfig: RDBConfig = RDBConfigJson;

    public directory: string;
    public dbFilename: string;

    public RESPEncoder = RESPEncoder;

    constructor(directory: string, dbFilename: string) {
        this.directory = directory;
        this.dbFilename = dbFilename;
        this.netServer = net.createServer((connection: net.Socket) =>  this.handleConnection(connection))

        RDBFileLogic.getRDBFiles(this, this.Data)
    }

    private PassiveDeletion() {
        const currentTime = Date.now()
        this.Data.forEach((document) =>  {
            if ( document.expire ===   0) {
                return;
            } 

            if ( document.expire < currentTime ) {
                this.Data.delete(document.key);
                console.log("Deleted Expired Data");
            }
        })
    }

    async GetCommands(): Promise<void> {
        const CommandsDirectory = fs.readdirSync(`./app/commands/`)

        for ( const Directory of CommandsDirectory ) {
            const Files = fs.readdirSync(`./app/commands/${Directory}`)
                .filter((file) =>  file.endsWith(".ts"));
            
            for ( const File of Files ) {
                const modulePath = path.join(__dirname, `commands`, Directory, File);
                const commandModule = await import(modulePath);

                const command: {
                    data: {
                        name: string,
                        description: string
                    },
                    run: (connection: net.Socket, args: any[], Data: Map<string, DatabaseSchema>, Server: server ) =>  void
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
        connection.on("data", (data: Object) =>  this.handleData(connection, data))
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

        if ( command ) {
            command.run(connection, args, this.Data, this);
            this.PassiveDeletion();
        } else {
            connection.write("-Error: Command not found\r\n")
        }
    }


    start(port: number, ipAddress: string) {
        RDBFileLogic.ensureDirectoryExists(this.directory);

        this.netServer.listen(port, ipAddress);
    }
}

const options = parseCommandLineArgs();
const directory = options.dir || RDBConfigJson.dir;
const dbFilename = options.dbfilename || RDBConfigJson.dbfilename;

fs.writeFileSync("./app/configs/rdbconfig.json", `{
    "dir": "${directory}",
    "dbfilename": "${dbFilename}"
}`)

const Server = new server(directory, dbFilename);

Server.GetCommands().catch(error =>  {
    console.error(error);
});
Server.start(6379, "127.0.0.1");
