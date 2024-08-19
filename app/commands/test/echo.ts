import * as net from "net";
import { DatabaseSchema } from "../../types";

export default {
    data: {
        name: "echo",
        description: "This command echos the other stuff"
    },
    async run( connection: net.Socket, args: any[], Data: Map<string, DatabaseSchema>  ) {
        connection.write(`$${args[0].length}\r\n${args[0]}\r\n`);
    }
}