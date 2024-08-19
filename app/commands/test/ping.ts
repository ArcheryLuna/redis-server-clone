import * as net from "net";
import { DatabaseSchema } from "../../types";

export default {
    data: {
        name: "ping",
        description: "A basic debug command"
    } ,
    async run( connection: net.Socket, args: any[], Data: Map<string, DatabaseSchema>  ) {
        connection.write(`+PONG\r\n`)
    }
}