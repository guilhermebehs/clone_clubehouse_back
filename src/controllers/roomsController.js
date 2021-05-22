import { Attendee } from "../entities/attendee.js";
import { Room } from "../entities/room.js";
import { constants } from "../util/constants.js";
import { CustomMap } from "../util/customMap.js";

export class RoomsController {
 
    #users = new Map()
    constructor({roomsPubSub}){
        this.roomsPubSub = roomsPubSub;
        this.rooms = new CustomMap({
           observer: this.#roomObserver(),
           customMapper: this.#mapRoom.bind(this)
       })
    }

    #roomObserver(){
        return {
            notify: (rooms)=> this.notifyRoomSubscribers(rooms)
        }
    }
    speakRequest(socket){
        const userId = socket.id;
        const user = this.#users.get(userId)
        const roomId = user.roomId
        const owner = this.rooms.get(roomId)?.owner
        if(!owner) return;
        console.log(user)
        socket.to(owner.id).emit(constants.event.SPEAK_REQUEST, user)
    }

    speakAnswer(socket, {answer, user}){
         const currentUser = this.#users.get(user.id)
         const updatedUser = new Attendee({
             ...currentUser,
             isSpeaker: answer
         })
         this.#users.set(user.id, updatedUser)
         const roomId = user.roomId
         const room = this.rooms.get(roomId)
         const userOnRoom = [...room.users.values()].find(({id})=> id === user.id)
         room.users.delete(userOnRoom)
         room.users.add(updatedUser)
         this.rooms.set(roomId, room)

         //informa ele mesmo
         socket.emit(constants.event.UPGRADE_USER_PERMISSION, updatedUser)
         //notifica a sala inteira para ligar para esse novo speaker
         this.#notifyUserProfileUpgrade(socket, roomId, updatedUser)
    }

    notifyRoomSubscribers(rooms){
        const event = constants.event.LOBBY_UPDATED;
        this.roomsPubSub.emit(event, [...rooms.values()])
    }

    onNewConnection(socket){
        const {id} = socket;
        this.#updateGlobalUserData(id)
    }

    joinRoom(socket, {user, room}){
        const userId = user.id = socket.id;
        const roomId = room.id;
        const updatedUserData = this.#updateGlobalUserData(userId, user, roomId);
        const updatedRoom = this.#joinUserRoom(socket, updatedUserData, room);
        this.#notifyUsersOnRoom(socket, roomId, updatedUserData)
        this.#replyWithActiveUsers(socket, updatedRoom.users )
    }

    #replyWithActiveUsers(socket, users){
        const event = constants.event.LOBBY_UPDATED
        socket.emit(event, [...users.values()]);
    }

    #notifyUsersOnRoom(socket, roomId, user){
        const event = constants.event.USER_CONNECTED
        socket.to(roomId).emit(event, user);
    }

    disconnect(socket){
        this.#logoutUser(socket)
    }

    #logoutUser(socket){
        const userId = socket.id
        const user = this.#users.get(userId);
        const roomId = user.roomId;
        this.#users.delete(userId)
        //limpar sujeira
        if(!this.rooms.has(roomId)){
            return
        }
        const room = this.rooms.get(roomId)
        const toBeRemoved = [...room.users].find(({id})=> id === userId)
        //remover o usuarios da sala
        room.users.delete(toBeRemoved)
        //se não tiver mais nenhum usuario na sala, matamos a sala
        if(!room.users.size){
            this.rooms.delete(roomId)
            return;
        }
        const disconnectedUserWasAnOwner = userId === room.owner.id;
        const onlyOneUserLeft = room.users.size === 1
        //validar se tem somente um usuario ou se o usuario era o dono da sala
        if(onlyOneUserLeft || disconnectedUserWasAnOwner){
            room.owner = this.#getNewRoomOwner(room, socket)
        }

        //atualiza a room no final
        this.rooms.set(roomId, room)

        //notifica a sala que o usuário saiu
        socket.to(roomId).emit(constants.event.USER_DISCONNECTED,user)

    }

    #notifyUserProfileUpgrade(socket, roomId, user){
        socket.to(roomId).emit(constants.event.UPGRADE_USER_PERMISSION,user)
    }

    #getNewRoomOwner(room, socket){
        const users = [...room.users.values()]
        const activeSpeakers = users.find(user => user.isSpeaker);
        //se quem desconectou era o dono, passa a liderança para o próximo
        //se não houver speakers, ele pega o attendee mais antigo (primera posição)
        const [newOwner] = activeSpeakers ? [activeSpeakers] : users;
        newOwner.isSpeaker = true;
        const outdatedUser = this.#users.get(newOwner.id)
        const updatedUser = new Attendee({
            ...outdatedUser,
            ...newOwner,
        })

        this.#users.set(newOwner.id, updatedUser)
        this.#notifyUserProfileUpgrade(socket,room.id,newOwner)
        return newOwner;

    }

    #joinUserRoom(socket, user, room){
        const roomId = room.id;
        const existingRoom = this.rooms.has(roomId)
        const currentRoom = existingRoom ? this.rooms.get(roomId) : {}
        const currentUser = new Attendee({
            ...user,
            roomId,
        })
        //definir dono da sala
        const [owner, users] = existingRoom ? 
                       [currentRoom.owner, currentRoom.users]: 
                       [currentUser, new Set()]
        
        const updatedRoom = this.#mapRoom({
            ...currentRoom,
            ...room,
            owner,
            users: new Set([...users,...[currentUser]])
        })

        this.rooms.set(roomId, updatedRoom);
        socket.join(roomId);
          
        return this.rooms.get(roomId);

    }

    #mapRoom(room){
        const users = [...room.users.values()];
        const speakersCount = users.filter(user => user.isSpeaker).length
        const featuredAttendees = users.slice(0,3)
        const mappedRoom = new Room({
            ...room,
            featuredAttendees,
            speakersCount,
            attendeesCount: room.users.size
        })
        
        return mappedRoom;
    }

    #updateGlobalUserData(userId, userData= {}, roomId= ''){
        const user = this.#users.get(userId) ?? {}
        const existingRoom = this.rooms.has(roomId)
        const updatedUserData = new Attendee({
            ...user,
            ...userData,
            roomId,
            isSpeaker: !existingRoom
        })
        this.#users.set(userId, updatedUserData)
        return this.#users.get(userId)
    }

    getEvents(){
        const functions = Reflect.ownKeys(RoomsController.prototype)
                  .filter(fn => fn !== 'constructor')
                  .map(name=> [name, this[name].bind(this)])
        return new Map(functions)
    }
    
}