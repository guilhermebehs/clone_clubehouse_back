import http from 'http';
import {Server} from 'socket.io';
import {constants} from '../util/constants.js';
export class SocketServer{

    #io;

    constructor({port}){
        this.port = port;
        this.namespaces = {}
    }

    attachEvents({routerConfig}){
         for(const routes of routerConfig){
             for(const [namespace, {events, eventEmitter}] of Object.entries(routes)){
                 const route = this.namespaces[namespace] = this.#io.of(`/${namespace}`)
                 route.on('connection', socket =>{
                     for(const [fnName,fnValue] of events){
                         socket.on(fnName, (...args)=> fnValue(socket, ...args))
              
                     }
                     eventEmitter.emit(constants.event.USER_CONNECTED, socket)
                 })
             }
         }
    }

    async start(){
        const server = http.createServer((req,res)=>{
            res.writeHead(200, {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'OPTIONS,POST,GET'
            })
            res.end('Hey there!!!')
        })
        this.#io = new Server(server, {
            cors:{
                origin: '*',
                credentials: false,
            }
        })
        // const room = this.#io.of('/room');
        // room.on('connection', socket =>{
        //     socket.emit('userConnection', 'socket id se conectou '+ socket.id)
        //     socket.on('joinRoom', (dados)=>{
        //         console.log('dados recebidos', dados)
        //     })
        // })
        return new Promise((resolve, reject)=>{
            server.on('error', reject)
            server.listen(this.port, ()=> resolve(server))
        })
    }
}