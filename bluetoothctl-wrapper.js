/*
I was working on this so I had an easy way to control bluetooth devices from Node.
But I realized the following things:
	 - bluetoothctl is just a "wrapper" for bluetoothd's dbus interface
	 - NodeJS already has dbus libraries
	 - Since I'm obviously not the first person in the world who wants to control bluetoothd via dbus with Node, there has to be other minimal-depenency packages that do it for me

The package I was looking for was literally named "bluez". Same name as the package bluetoothd comes from.
There is a "bluezjs" which depends on a more attractive-looking node-dbus-next, but they don't seem mature enough at the time of writing.
So I'm going to be using the "bluez" package for my bluetooth interfacing.

I want to save this somewhere because this might be useful in interfacing into other "black-box-type" cli interfaces. (Electron-based parted UI????)
*/

const child_process = require("child_process");
const readline = require("readline");
class CliComm {
	constructor(prompt, input, output, events){
		this.buffLen = 0;
		this.buff;
		this.prompt = prompt;
		this.input = input;
		this.output = output;
		this.readLine = true;
		this.events = events;
		this.commandResponses = [];
		this.started = new Promise((resolve, reject) => {
			this.promiseCallbacks = [{resolve, reject}];
		});
		this.input.on("error", (e) => {
			for (let i = 0; i < this.promiseCallbacks.length; i += 1){
				this.promiseCallbacks.reject(e);
			}
			this.promiseCallbacks = [];
		});
		this.input.on("end", () => {
			const e = new Error("End of stream");
			for (let i = 0; i < this.promiseCallbacks.length; i += 1){
				this.promiseCallbacks.reject(e);
			}
			this.promiseCallbacks = [];
		});
		this.input.on("data", (c) => {
			for (let i = 0; i < c.length; i += 1){
				if (c[i] === 10 || c[i] === 13){
					this.buff = Buffer.alloc(0);
					if (this.readLine){
						this.examineLine(Buffer.concat([this.buff, c.slice(0, i)], this.buffLen + i));
					}
					this.readLine = true;
					c = c.slice(i + 1);
					this.buffLen = 0;
					i = 0;
				}
			}
			this.buffLen += c.length;
			this.buff = Buffer.concat([this.buff, c], this.buffLen);
			if (this.readLine && this.buffLen >= this.prompt.length){
				if (this.prompt.equals(this.buff.slice(0, this.prompt.length))){
					this.resolveCommand();
					this.readLine = false;
				}
			}
		});
	}
	runCommand(str) {
		return new Promise((resolve, reject) => {
			this.promiseCallbacks.push({
				resolve, reject
			});
			this.output.write(str+"\n");
		});
	}
	resolveCommand() {
		if (this.promiseCallbacks.length === 0){
			return;
		}
		const {resolve, reject} = this.promiseCallbacks.shift();
		resolve(this.commandResponses);
		this.commandResponses = [];
	}
	examineLine(buff) {
		if (buff.length >= this.prompt.length){
			if (this.prompt.equals(buff.slice(0, this.prompt.length))){
				this.resolveCommand();
				return;
			}
		}
		const str = buff.toString();
		const firstWord = str.substring(0, str.indexOf(" ")); 
		if (this.events[firstWord] != null){
			this.events[firstWord](str.substring(firstWord.length + 1));
			return;
		}
		if (this.promiseCallbacks.length === 0){
			console.error("Unhandled cli event: "+JSON.stringify(firstWord));
			console.error(str);
			return;
		}
		this.commandResponses.push(str);
	}
}

class Bluetooth {
	constructor() {
		this.process = child_process.spawn("bluetoothctl");
		this.process.on("error", (err) => {
			this._err = err;
		});
		this.comm = new CliComm(Buffer.from("\u001b[0;94m[bluetooth]\u001b[0m# "), this.process.stdout, this.process.stdin, {
			"\u001b[K[\u001b[0;92mNEW\u001b[0m]": (str) => {
				console.log("NEW> "+str);
			},
			"\u001b[K[\u001b[0;91mDEL\u001b[0m]": (str) => {
				console.log("DEL> "+str);
			}
			"\u001b[K[\u001b[0;93mCHG\u001b[0m]": (str) => {
				console.log("CHG> "+str);
			}
		});
		/*
		this.rl = readline.createInterface(this.process.stdout);
		this.rl.on("line", (str) => {
			console.log(Buffer.from(str));
			const firstWord = str.substring(0, str.indexOf(" "));
			console.log(firstWord);
		});
		*/
	}
	test() {
		this.process.stdin.write("list\n")
	}
	_checkError() {
		if (this._err){
			throw this._err;
		}
	}
}
module.exports = {Bluetooth};
