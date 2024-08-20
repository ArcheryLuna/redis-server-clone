import * as net from "net";
import { DatabaseSchema } from "../../types";
import { server } from "../../main";

export default {
    data: {
        name: "get",
        description: "This command get's data from the database"
    },
    async run( connection: net.Socket, args: any[], Data: Map<string, DatabaseSchema>, Server: server) {
        if ( args.length < 1 ) {
            connection.write("-Error: No arguments were parsed\r\n");
            return;
        }

        const currentTime = Date.now();
        const value = Data.get(args[0])
        
        if ( value?.expire ===   0 ) {
            if ( value?.value ) {
                connection.write(`+${value.value}\r\n`)
                return;
            } else {
                connection.write(`-Error: No value found`);
            }  
        }

        if ( value?.expire ) {
            if ( value.expire <= currentTime) {
                Data.delete(args[0]);
                connection.write("$-1\r\n")
            } else {
                connection.write(`+${value.value}\r\n`);
            }
        }
    }
}