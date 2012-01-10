// Test with the epic VirtualSerialPortApp - http://code.google.com/p/macosxvirtualserialport/

var SerialPort = require("serialport").SerialPort;
var util = require("util"), repl = require("repl");

var serial_port = new SerialPort("/dev/tty.SLAB_USBtoUART", {baudrate: 9600, parser: statusParser() });

var last_data = null;

serial_port.on("data", function (data) {
  //util.puts("here: "+data);
  //if(data.length === 1) util.puts("byte: " + data.readUInt8(0));
  util.puts(data);
  last_data = data;
});
serial_port.on("error", function (msg) {
  util.puts("error: "+msg);
});
var ctx = repl.start("=>").context;

ctx.send = write;
ctx.status = status;
ctx.serialport = serial_port;
ctx.last = last;

var timerHandle = null;
ctx.poll = function() {
    timerHandle = setInterval(status, 1000);
};

ctx.stoppoll = function() {
    timerHandle && clearInterval(timerHandle);
    timerHandle = null;
};

function last() {
    return last_data;
}

function write(msg) {
    serial_port.write(msg);
}

function status() {
    write("A");
}

function valsFor(byt) {
    var a = byt >> 4;
    var b = byt - (a * 16);
    return { 
        a: a, 
        b: b, 
        toString: function() { 
            return "{ a: " + this.a + ", b: " + this.b + "}";
        }
    };
}



function buildStatus(buffed) {
    // first two bytes are bit flags for device status
    // bytes 3 and 4 are the T1 value
    var res = buffed[1] & parseInt("00000100", 2);
    var firstPair = valsFor(buffed[2]);
    var secondPair = valsFor(buffed[3]);
    
    util.puts(" first: " + firstPair);
    util.puts("second: " + secondPair);
    
    
    if(firstPair.a === 11) {
        return (res ? 10 : 1) * 
            (firstPair.b * 10
             + secondPair.a
             + (secondPair.b / 10));
    } else if(firstPair.a === 10) {
      util.puts("shit");   
    } else {
        return (res ? 10 : 1) * 
            (firstPair.a * 100 + firstPair.b * 10
             + secondPair.a + (secondPair.b / 10));
    }
    
    return buffed;
}

function statusParser() {
    var buff = null;
    
    return function(emitter, buffer) {
        // we're always sent one byte at a time
        // if we have no buffer, that means this should be
        // the first bit of data. should be a 2
        
        for(var i = 0; i < buffer.length; i++) {
            var val = buffer.readUInt8(i);
            util.puts("handling " + val + " from " + i + " of " + buffer.length);
        
            if(buff === null && val !== 2) { 
                util.puts("not the magic: " + val);
                continue;
            }
            if(buff === null && val === 2) {
                util.puts("starting parse");
                buff = [];
                continue;
            }
            if(buff !== null && buff.length === 8 && val === 3) {
                // we're done! emit.
                util.puts("finishing parse");
            
                try { emitter.emit('data', buildStatus(buff)); }
                finally { buff = null; }
            
                continue;
            }
            if(buff !== null) {
                util.puts("pushing " + val);
                buff.push(val);
            }
        }
    }
    
}

ctx.poll();

//serial_port.close();
