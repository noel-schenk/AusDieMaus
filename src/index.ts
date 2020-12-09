import { h, Component, render } from 'preact';
import htm from 'htm';
import { Subject } from 'rxjs';
import { Template } from 'webpack';
import clone from 'clone';
const html = htm.bind(h);

class AusDieMausState {
    public rows = new Array<number>();
    constructor() {
        this.rows[0] = 0; //max 3
        this.rows[1] = 0; //max 5
        this.rows[2] = 0; //max 6
        this.rows[3] = 0; //max 6
        this.rows[4] = 0; //max 5
        this.rows[5] = 0; //max 3
    }
}

class AusDieMausBoard extends Component {
    private _ausDieMausState: AusDieMausState;
    public set ausDieMausState(state: AusDieMausState) {
        this._ausDieMausState = state;
        this.setState({ausDieMausState: state});
    }
    public get ausDieMausState() {
        return this._ausDieMausState;
    }
    constructor() {
        super();
        this.ausDieMausState = new AusDieMausState();
    }
    render({updateAusDieMausState}: any, {ausDieMausState = this.ausDieMausState}: {ausDieMausState: AusDieMausState}) {
        (updateAusDieMausState as Subject<AusDieMausState>).subscribe((ausDieMausState: AusDieMausState) => {
            this.ausDieMausState = ausDieMausState;
        });
        const htmFor = (times: number, cb: () => preact.VNode<any> | preact.VNode<any>[]) => {
            const returnNodes = new Array<preact.VNode<any> | preact.VNode<any>[]>();
            for (let i = 0; i < times; i++) {
                returnNodes.push(cb());
            }
            return returnNodes;
        }
        return html`
            ${ausDieMausState.rows.map(row => html`
                <div class='row'>
                    ${htmFor(row, () => html`
                        <div class='bubble'>

                        </div>
                    `)}
                </div>
            `)}
        `;
    }
}

class RenderGame {
    public updateAusDieMausState = new Subject<AusDieMausState>();
    render() {
        render(html`<${AusDieMausBoard} updateAusDieMausState=${this.updateAusDieMausState} />`, document.body);
    }
}

class PlayGame {
    public activeState = new AusDieMausState();
    public currentPlayer = false; //true === player 1 ... false === player 2
    public stateToReactionP1 = new Array<{state: AusDieMausState; reaction: AusDieMausState}>();
    public stateToReactionP2 = new Array<{state: AusDieMausState; reaction: AusDieMausState}>();

    public renderGame = new RenderGame();
    
    constructor() {
        this.renderGame.render();
    }

    public async training() {
        const helper = new Helper();
        while (!helper.checkIfFinished(this.activeState)) {
            console.log('new move');
            const newState = helper.getValidMove(this.activeState);
            const newStateToReaction = {state: clone(this.activeState), reaction: clone(newState)};

            if (this.currentPlayer) {
                this.stateToReactionP1.push(newStateToReaction);
            } else {
                this.stateToReactionP2.push(newStateToReaction);
            }
            this.currentPlayer = !this.currentPlayer;
            this.activeState = newState;
            
            this.renderGame.updateAusDieMausState.next(newState);
            
            await new Promise(resolve => setTimeout(resolve, 10));
        }
    }
}

class Helper {
    public maxStates = [3,5,6,6,5,3];
    
    constructor() {}
    
    checkIfFinished(state: AusDieMausState) {
        let isFinished = true;
        state.rows.forEach((row, i) => {
            if (row < this.maxStates[i]) {
                isFinished = false;
            }
        });
        if (isFinished) {
            return true;
        } else {
            return false;
        }
    }
    
    getValidMove(state: AusDieMausState) {
        let randRow = this.getRandomRow();
        let randomIncrease: number;
        const newState = clone(state);
        while ((randomIncrease = this.getRandomIncrease(randRow, state)) < 1) {
            randRow = this.getRandomRow();
        }
        newState.rows[randRow] = state.rows[randRow] + randomIncrease;
        return newState;
    }
    
    getRandomRow() {
        return Math.floor(Math.random() * Math.floor(6));
    }
    
    getRandomIncrease(row: number, state: AusDieMausState) {
        const maxIncrease = this.getMaxIncrease(row, state);
        if (maxIncrease < 1) {
            return 0;
        }
        return Math.floor(Math.random() * Math.floor(maxIncrease)) + 1; // between one and the max number itself
    }
    
    getMaxIncrease(row: number, state: AusDieMausState) {
        return this.maxStates[row] - state.rows[row];
    }
    
    checkIfMoveValid(state: AusDieMausState, lastState: AusDieMausState) {
        if (JSON.stringify(state.rows) === JSON.stringify(lastState.rows)) {
            return false;
        }
        return this.checkMaxs(state.rows);
    }
    
    checkMaxs(vals: Array<number>) {
        vals.forEach((val, i) => {
            if (!(val <= this.maxStates[i])) {
                return false;
            }
        });
        return true;
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const loadTraining = async () => {
        const newGame = new PlayGame();
        await newGame.training();
        console.log(newGame.stateToReactionP1, newGame.stateToReactionP2);
        loadTraining();
    };
    loadTraining();
});
