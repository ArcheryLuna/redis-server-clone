import * as net from "net";

// You can use print statements as follows for debugging, they'll be visible when running tests.
console.log("Logs from your program will appear here!");

// Uncomment this block to pass the first stage
const server: net.Server = net.createServer((connection: net.Socket) => {
// Handle connection
    connection.on("data", (data: Object) =>  {

        // Take data create array 0 is command anything after 0 is the args
        // Take out all the unessisary data
        // parse the command via a switch statement

        console.log(JSON.stringify(data.toString()))

        const command = data.toString().split("\r\n").filter((line) => 
            !line.startsWith("*") && 
            !line.startsWith("$") && 
            line !== ""
        );

        // console.log(command);
        
        switch(command[0].toLowerCase()) {
            case "echo":
                connection.write(`$${command[1].length}\r\n${command[1]}\r\n`);
                break;
            case "ping":
                connection.write(`+PONG\r\n`)
        }
    })

});

server.listen(6379, "127.0.0.1");
