import * as net from "net";
import { DatabaseSchema } from "../../types";

export default {
    data: {
        name: "get",
        description: "This command get's data from the database"
    },
    async run( connection: net.Socket, args: any[], Data: Map<string, DatabaseSchema>  ) {
        if ( args.length < 1 ) {
            connection.write("-Error: No arguments were parsed\r\n");
            return;
        }

        const value = Data.get(args[0])

        if ( value?.value ) {
            connection.write(`+${value.value}\r\n`)
            return;
        } else {
            connection.write(`-Error: No value found`);
        }
    }
}