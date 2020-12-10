import { h, Component, render } from 'preact';
import htm from 'htm';
import { AsyncSubject, Observable, Subject } from 'rxjs';
import clone from 'clone';
import * as tf from '@tensorflow/tfjs';
import { isTaggedTemplateExpression } from 'typescript';
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

type StateToReaction = Array<{state: AusDieMausState; reaction: AusDieMausState}>;

class PlayGame {
    public activeState = new AusDieMausState();
    public currentPlayer = false; //true === player 1 ... false === player 2
    
    public stateToReactionP1: StateToReaction = new Array<{state: AusDieMausState; reaction: AusDieMausState}>();
    public stateToReactionP2: StateToReaction = new Array<{state: AusDieMausState; reaction: AusDieMausState}>();

    public renderGame = new RenderGame();
    
    constructor() {
        this.renderGame.render();
    }

    public async training(ai?: (state: AusDieMausState) => void) {
        const helper = new Helper();
        while (!helper.checkIfFinished(this.activeState)) {
            this.currentPlayer = !this.currentPlayer;
            // console.log(this.currentPlayer === true ? 'Player 1' : 'Player 2');

            let newState: AusDieMausState;

            if (ai) {
                await ai(this.activeState);
                newState = helper.getValidMove(this.activeState);
            } else {
                newState = helper.getValidMove(this.activeState);
            }

            const newStateToReaction = {state: clone(this.activeState), reaction: clone(newState)};

            if (this.currentPlayer) {
                this.stateToReactionP1.push(newStateToReaction);
            } else {
                this.stateToReactionP2.push(newStateToReaction);
            }
            this.activeState = newState;
            
            this.renderGame.updateAusDieMausState.next(newState);
            
            await new Promise(resolve => setTimeout(resolve, 10));
        }
        console.log(this.currentPlayer ? 'Player 2 Wins!' : 'Player 1 Wins!');
        return this.currentPlayer ? this.stateToReactionP2 : this.stateToReactionP1;
    }
}

class Helper {
    public static maxStates = [3,5,6,6,5,3];
    
    constructor() {}
    
    checkIfFinished(state: AusDieMausState) {
        let isFinished = true;
        state.rows.forEach((row, i) => {
            if (row < Helper.maxStates[i]) {
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
        return Helper.maxStates[row] - state.rows[row];
    }
    
    checkIfMoveValid(state: AusDieMausState, lastState: AusDieMausState) {
        if (JSON.stringify(state.rows) === JSON.stringify(lastState.rows)) {
            return false;
        }
        return this.checkMaxs(state.rows);
    }
    
    checkMaxs(vals: Array<number>) {
        vals.forEach((val, i) => {
            if (!(val <= Helper.maxStates[i])) {
                return false;
            }
        });
        return true;
    }
}

class AusDieMausAI {
    private learningRate = 0.1;
    
    private model = tf.sequential();

    private trainingData = new Array<StateToReaction>();

    
    constructor() {
        this.model.add(tf.layers.dense({units: 6, inputShape: [6], activation: 'sigmoid'}));
        this.model.add(tf.layers.dense({units: 12, activation: 'sigmoid'}));
        this.model.add(tf.layers.dense({units: 18, activation: 'sigmoid'}));
        this.model.add(tf.layers.dense({units: 12, activation: 'sigmoid'}));
        this.model.add(tf.layers.dense({units: 6, activation: 'sigmoid'}));

        this.model.compile({optimizer: tf.train.adam(this.learningRate), loss: 'meanSquaredError'});
    }

    addData(stateToReaction: StateToReaction) {
        this.trainingData.push(stateToReaction);
    }

    async train() {
        let trainingData = new Array<{state: AusDieMausState;reaction: AusDieMausState;}>();

        for (let stateToReaction of this.trainingData) for (let s2r of stateToReaction) trainingData.push(s2r);

        for (let td of trainingData) {
            const normalizedState = td.state.rows.map((row, i) => this.normalizeData(row, Helper.maxStates[i]));
            const normalizedReaction = td.reaction.rows.map((row, i) => this.normalizeData(row, Helper.maxStates[i]));

            const stateTensor = tf.tensor(normalizedState, [1, 6]);
            const reactionTensor = tf.tensor(normalizedReaction, [1, 6]);
            
            console.log(stateTensor, 'stateTensor');

            await this.model.fit(
                stateTensor,
                reactionTensor,
                {
                    epochs: 1,
                    batchSize: 1
                }
            );
        }
    }

    classify(state: AusDieMausState) {
        const inputData = tf.tensor(state.rows, [1, 6]);
        const prediction: Array<number> = Array.from((this.model.predict(inputData) as tf.Tensor).dataSync());
        const revertNormalizedPrediction = prediction.map((row, i) => this.revertNormalizeData(row, Helper.maxStates[i]));
        console.log(revertNormalizedPrediction, 'prediction');
    }

    private normalizeData(val:number, max:number) {
        return val/max;
    }
    private revertNormalizeData(val:number, max:number) {
        return val*max;
    }
}

document.addEventListener("DOMContentLoaded", () => {
    console.log(tf);
    let iteration:number = 0;

    const ausDieMausAI = new AusDieMausAI();  
    const loadTraining = async () => {
        const newGame = new PlayGame();
        let winData: StateToReaction; 

        console.log(`Iteration: ${iteration}`)

        if (iteration === 200) {
            await ausDieMausAI.train();
        }

        if (iteration >= 200) {
            winData = await newGame.training((state: AusDieMausState) => ausDieMausAI.classify(state));
        } else {
            winData = await newGame.training();
        }

        ausDieMausAI.addData(winData);

        iteration++;
        loadTraining();
    };
    loadTraining();
});
