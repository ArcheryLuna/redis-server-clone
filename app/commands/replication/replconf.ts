import type net from "net"
import { RESPEncoder } from "../../utils/RESPEncoder"
import { RedisEntry } from "../../types"
import { server } from "../../main"

export default {
    data: {
        name: "replconf",
        description: "Handle replication configuration from replicas"
    },
    async run(connection: net.Socket, args: any[], Data: Map<string, RedisEntry>, Server: server) {
        connection.write(RESPEncoder({
            type: "simpleString",
            content: "OK"
        }))
    }
}
