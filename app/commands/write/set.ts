import * as net from "net";
import { DatabaseSchema } from "../../types";

export default {
    data: {
        name: "set",
        description: "This command set's data into the database"
    },
    async run( connection: net.Socket, args: any[], Data: Map<string, DatabaseSchema>  ) {
        if ( args.length < 2 ) {
            connection.write("-Error: No arguments were parsed\r\n");
            return;
        } 

        console.log(args);

        Data.set(args[0], {
            key: args[0],
            value: args[1]
        });

        connection.write("+OK\r\n");
        return;
    }
}