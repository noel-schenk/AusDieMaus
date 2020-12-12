import { h, Component, render } from 'preact';
import htm from 'htm';
import { AsyncSubject, Observable, Subject } from 'rxjs';
import clone from 'clone';
import PouchDB from 'pouchdb';
import chartjs from 'chart.js';
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
    getStateID() {
        return this.rows.join('');
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
        (updateAusDieMausState as Subject<AusDieMausState>).subscribe(ausDieMausState => {
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

class PredictionMaker extends Component{
    predictionRequest = '';
    ausDieMausStatisticsSubject: Subject<AusDieMausStatistics>;
    ausDieMausStatistics: AusDieMausStatistics;

    componentDidMount() {
        this.ausDieMausStatisticsSubject.subscribe(ausDieMausStatistics => {
            this.ausDieMausStatistics = ausDieMausStatistics;
        });
    }

    getPrediction() {
        const ausDieMausState = new AusDieMausState();
        ausDieMausState.rows = Array.from(String(this.predictionRequest), Number);

        if (this.ausDieMausStatistics) {
            this.ausDieMausStatistics.getData(ausDieMausState).then(ausDieMausState => {
                console.log(`Try: ${(ausDieMausState as AusDieMausState)?.rows}`);
                debugger;
            });
        } else {
            console.info('NO Statistics FOUND');
        }
        
    }

    changePredictionRequest(e: InputEvent) {
        this.predictionRequest = (e.target as HTMLInputElement).value;
    }

    render({ausDieMausStatistics}: any) {
        this.ausDieMausStatisticsSubject = ausDieMausStatistics;

        return html`
            <input onInput=${(e: InputEvent) => this.changePredictionRequest(e)} />
            <button onClick=${() => this.getPrediction()} />
        `;
    }
}

class Chart extends Component {
    data = new Array(30).fill(0);

    updateChart: Subject<boolean>;

    constructor() {
        super();
    }

    componentDidMount() {
        this.updateChart.subscribe(async win => {
            this.data.shift();
            const currentWins = this.data.slice(-1)[0];
            this.data.push(win ? currentWins + 1 : currentWins - 1);
            this.data = this.data.map(data => data - this.data[0]);
        });
    }

    render({updateChart}: any) {
        this.updateChart = updateChart as Subject<boolean>;
        return html`
            <div class='chart'>
            ${this.data.map(data => html`
                <div class='chartData' style='height:${data}px'>
                    
                </div>
            `)}
            </div>
        `;
    }
}

class RenderGame {
    public updateAusDieMausState = new Subject<AusDieMausState>();
    public updateChart = new Subject<boolean>();
    public ausDieMausStatistics = new Subject<AusDieMausStatistics>();
    render() {
        render(html`<${AusDieMausBoard} updateAusDieMausState=${this.updateAusDieMausState} /><${Chart} updateChart=${this.updateChart} /><${PredictionMaker} ausDieMausStatistics=${this.ausDieMausStatistics} />`, document.body);
    }
}

type StateToReaction = {state: AusDieMausState; reaction: AusDieMausState};
type StateToReactions = Array<StateToReaction>;

class PlayGame {
    public activeState = new AusDieMausState();
    public currentPlayer = false; //true === player 1 ... false === player 2
    
    public stateToReactionP1: StateToReactions = new Array<StateToReaction>();
    public stateToReactionP2: StateToReactions = new Array<StateToReaction>();

    public renderGame: RenderGame;
    
    constructor(renderGame: RenderGame) {
        this.renderGame = renderGame;
        this.renderGame.render();
    }

    public async training(ai?: (state: AusDieMausState) => Promise<false | AusDieMausState>) {
        const helper = new Helper();
        while (!helper.checkIfFinished(this.activeState)) {
            this.currentPlayer = !this.currentPlayer;
            // console.log(this.currentPlayer === true ? 'Player 1' : 'Player 2');

            let newState: AusDieMausState;

            if (ai && this.currentPlayer) {
                const aiRes = await ai(this.activeState);
                console.log(aiRes, 'aiRes');
                newState = aiRes ? aiRes : helper.getValidMove(this.activeState);
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
        const win = this.currentPlayer ? this.stateToReactionP2 : this.stateToReactionP1;
        const loose = !this.currentPlayer ? this.stateToReactionP2 : this.stateToReactionP1

        this.renderGame.updateChart.next(!this.currentPlayer);

        return {win, loose};
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

type Reaction = {winRate: number; dataAmount: number; rows: Array<number>};
type Reactions = Map<string, Reaction>;

class AusDieMausStatistics {

    db = new PouchDB('AusDieMausAI');

    constructor() {}

    async getData(state: AusDieMausState) {
        const stateID = state.getStateID();
        const docData: any = await this.db.get(stateID).catch(() => {
            return null;
        }).then(docData => {
            return docData;
        })
        const reactions: Reactions = docData?.reactions;
        if (reactions) {
            const reaction = Array.from(reactions.values()).reduce((p, c) => (p.winRate > c.winRate) ? p : c);
            if (reaction) {
                const newAusDieMausState = new AusDieMausState();
                newAusDieMausState.rows = reaction.rows;
                return newAusDieMausState;
            }
        }
        return false;
    }

    async addData(stateToReactions: StateToReactions, win: boolean) {
        const change = win ? 1 : 0;
        stateToReactions.forEach(stateToReaction => {
            this.addDataToDb(stateToReaction, change);
        });
    }

    async addDataToDb(stateToReaction: StateToReaction, change: number) { // change = 1 for win 0 for loose
        const stateID = stateToReaction.state.getStateID();
        const docData: any = await this.db.get(stateID).catch(() => {
            return null;
        }).then(docData => {
            return docData;
        })
        const reactions: Reactions = docData?.reactions;
        const reactionStateID = stateToReaction.reaction.getStateID();
        if (reactions) { // if there are already reactions for this state recorded
            const dbProposedState = reactions.get(reactionStateID);
            if (dbProposedState) { // if there is already this reaction for a win or loose recorded
                const winRate = dbProposedState.winRate;
                const dataAmount: number = dbProposedState.dataAmount;
                dbProposedState.winRate = (((winRate * dataAmount) + change) / (dataAmount + 1));
                dbProposedState.dataAmount = dataAmount + 1;
                reactions.set(reactionStateID, dbProposedState);
                await this.db.put({_id: stateID, reactions, _rev: docData?._rev }, {force: true});
            } else {
                reactions.set(reactionStateID, { winRate: change, dataAmount: 1, rows: stateToReaction.reaction.rows });
                await this.db.put({_id: stateID, reactions, _rev: docData?._rev }, {force: true});
            }
        } else {
            const newReactions: Reactions = new Map();
            newReactions.set(reactionStateID, { winRate: change, dataAmount: 1, rows: stateToReaction.reaction.rows });
            await this.db.put({_id: stateID, reactions: newReactions, _rev: docData?._rev }, {force: true});
        }
    }
}

document.addEventListener("DOMContentLoaded", () => {
    let iteration:number = 0;

    const ausDieMausStatistics = new AusDieMausStatistics();
    const renderGame = new RenderGame();
    renderGame.render();
    renderGame.ausDieMausStatistics.next(ausDieMausStatistics);

    const loadTraining = async () => {
        const newGame = new PlayGame(renderGame);

        let results: {win: StateToReactions; loose: StateToReactions}; 

        console.log(`Iteration: ${iteration}`);

        results = await newGame.training((state: AusDieMausState) => ausDieMausStatistics.getData(state));

        ausDieMausStatistics.addData(results.win, true);
        ausDieMausStatistics.addData(results.loose, false);

        iteration++;

        loadTraining();
    };
    loadTraining();
});
