import * as net from "net";
import { DatabaseSchema } from "../../types";
import { server } from "../../main";

export default {
    data: {
        name: "config",
        description: "This command get's the config data from the config files"
    },
    async run( connection: net.Socket, args: any[], Data: Map<string, DatabaseSchema>, Server: server) {
        if ( args.length < 2 ) {
            connection.write("-Error: Not enougth arguments\r\n");
            return;
        }

        const commandWord: string = args[0].toLowerCase();

        switch(commandWord) {
            case "get":
                const configParam: string = args[1].toLowerCase();
                if ( configParam ===  "dir") {
                    const responseArray = [
                        { type: "bulkString", content: "dir" },
                        { type: "bulkString", content: Server.directory }
                    ];;

                    connection.write(Server.RESPEncoder({ type: "array", content: JSON.stringify(responseArray) }));
                }

                else if ( configParam ===   "dbfilename") {
                    const responseArray = [
                        { type: "bulkString", content: "dbfilename" },
                        { type: "bulkString", content: Server.dbFilename }
                    ];

                    connection.write(Server.RESPEncoder({ type: "array", content: JSON.stringify(responseArray) }));
                }

                else {
                    connection.write("-Error: Unsupported CONFIG subcommand\r\n");
                }
                
                break;
            default:
                connection.write("-Error: Unsupported CONFIG subcommand\r\n");
                break;
        }
    }
}