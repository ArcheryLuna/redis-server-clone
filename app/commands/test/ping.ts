import * as net from "net";
import { DatabaseSchema } from "../../types";
import { server } from "../../main"

export default {
    data: {
        name: "ping",
        description: "A basic debug command"
    } ,
    async run( connection: net.Socket, args: any[], Data: Map<string, DatabaseSchema>, Server: server) {
        connection.write(`+PONG\r\n`)
    }
}