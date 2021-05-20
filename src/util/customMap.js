export class CustomMap extends Map{
    
    #observer
    #customMapper

    constructor({observer, customMapper}){
        super()
        this.#observer = observer
        this.#customMapper = customMapper
    }

    set(...args){
        const result = super.set(...args)
        this.#observer.notify(this)
        return result;
    }

    delete(...args){
        const result = super.delete(...args)
        this.#observer.notify(this)
        return result;
    }

    * values(){
        for(const value of super.values()){
            yield this.#customMapper(value)
        }
    }

}