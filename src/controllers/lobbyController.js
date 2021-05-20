import { constants } from "../util/constants.js";

export class LobbyController {
    constructor({activeRooms, roomsListener}){
        this.activeRooms = activeRooms
        this.roomsListener = roomsListener;
    }

    onNewConnection(socket){
        const {id} = socket;
        console.log('Lobby connection is stablished with', id)
        this.#updateLobbyRooms(socket, [...this.activeRooms.values()])
        this.#activateEventProxy(socket)
    }

    #updateLobbyRooms(socket, activeRooms){
        socket.emit(constants.event.LOBBY_UPDATED, activeRooms)
    }

    #activateEventProxy(socket){
        this.roomsListener.on(constants.event.LOBBY_UPDATED, rooms =>{
            this.#updateLobbyRooms(socket, rooms)
        })
    }

    getEvents(){
        const functions = Reflect.ownKeys(LobbyController.prototype)
                  .filter(fn => fn !== 'constructor')
                  .map(name=> [name, this[name].bind(this)])
        return new Map(functions)
    }
    
}