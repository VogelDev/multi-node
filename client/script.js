// init web objects
var gameDiv = document.getElementById('gameDiv');
var ctx = document.getElementById("ctx").getContext("2d");
ctx.font = '30px Arial';
var WIDTH = 500;
var HEIGHT = 500;

var chatText = document.getElementById("chat-text");
var chatInput = document.getElementById("chat-input");
var chatForm = document.getElementById("chat-form");

var signDiv = document.getElementById('signDiv');
var signDivUsername = document.getElementById('signDiv-username');
var signDivSignIn = document.getElementById('signDiv-signIn');
var signDivSignUp = document.getElementById('signDiv-signUp');
var signDivPassword = document.getElementById('signDiv-password');

var socket = io();

// sign in logic

signDivSignIn.onclick = function() {
    socket.emit('signIn', {
        username: signDivUsername.value,
        password: signDivPassword.value
    });
}

signDivSignUp.onclick = function() {
    socket.emit('signUp', {
        username: signDivUsername.value,
        password: signDivPassword.value
    });
}

socket.on('signInResponse', function(data) {
    if (data.success) {
        signDiv.style.display = 'none';
        gameDiv.style.display = 'inline-block';
    } else
        alert("Sign in unsuccessful");
})

socket.on('signUpResponse', function(data) {
    if (data.success) {
        alert("Sign up successful");
    } else
        alert("Sign up unsuccessful: " + data.err);
})

//chat logic

socket.on('addToChat', function(data) {
    chatText.innerHTML += '<div>' + data + '<div>';
    chatText.scrollTop = chatText.scrollHeight;
});

chatForm.onsubmit = function(e) {
    e.preventDefault();

    socket.emit('sendMsgToServer', chatInput.value);
    chatInput.value = '';
}

// game logic

// init game objects

var Img = {};
Img.player = new Image();
Img.player.src = '/client/img/player.png';
Img.bullet = new Image();
Img.bullet.src = '/client/img/bullet.png';
Img.map = new Image();
Img.map.src = '/client/img/map.png';

var Player = function(initPack){
    var self = {};
    self.id = initPack.id;
    self.number = initPack.number;
    self.x = initPack.x;
    self.y = initPack.y;
    self.hp = initPack.hp;
    self.hpMax = initPack.hpMax;
    self.score = initPack.score;

    self.draw = function(){

        var x = self.x - Player.list[selfId].x + WIDTH/2;
        var y = self.y - Player.list[selfId].y + HEIGHT/2;

        //draw healthbar
        ctx.fillStyle = "#00FF22"; //found bug where health bar starts black, so setting to green
        var hpFrac = self.hp / self.hpMax;
        var hpWidth = 30 * hpFrac;
        var green = Math.floor(255 * hpFrac);
        var red = Math.floor(255 - green);
        green = green.toString(16);
        red = red.toString(16);
        ctx.fillStyle = "#"+red + green + "22";
        ctx.fillRect(x - hpWidth / 2, y - 35, hpWidth, 4);

        //draw player
        var width = Img.player.width * 2;
        var height = Img.player.height * 2;

        ctx.drawImage(Img.player,
            0,0,Img.player.width, Img.player.height,
            x-width/2, y-height/2, width, height);

/*      // drawing player with number and a circle
        ctx.fillStyle = "#FF0000";
        ctx.beginPath();
        ctx.arc(self.x, self.y, 15, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.fillStyle = "#000000";
        ctx.fillText(self.number, self.x - 10, self.y + 10);
*/
        //ctx.fillText(self.score, self.x, self.y - 40);
    }


    Player.list[self.id] = self;
    return self;
}
Player.list = {};

var Bullet = function(initPack){
    var self = {};
    self.id = initPack.id;
    self.number = initPack.number;
    self.x = initPack.x;
    self.y = initPack.y;

    self.draw = function(){
        var width = Img.bullet.width / 2;
        var height = Img.bullet.height / 2;

        var x = self.x - Player.list[selfId].x + WIDTH/2;
        var y = self.y - Player.list[selfId].y + HEIGHT/2;

        ctx.drawImage(Img.bullet,
            0,0,Img.bullet.width, Img.bullet.height,
            x-width/2, y-height/2, width, height);

        // draw rectangle for bullet
        //ctx.fillRect(self.x - 5, self.y - 5, 10, 10);
    }

    Bullet.list[self.id] = self;
    return self;
}
Bullet.list = {};

var selfId = null;
socket.on('init', function(data) {
    if(data.selfId)
        selfId = data.selfId;
    for (var i = 0; i < data.player.length; i++) {
        new Player(data.player[i]);
    }
    for (var i = 0; i < data.bullet.length; i++) {
        new Bullet(data.bullet[i]);
    }
});

// update

socket.on('update', function(data) {
    for (var i = 0; i < data.player.length; i++) {
        var pack = data.player[i];
        var p = Player.list[pack.id];
        if(p){
            if(pack.x !== undefined)
                p.x = pack.x;
            if(pack.y !== undefined)
                p.y = pack.y;
            if(pack.hp !== undefined)
                p.hp = pack.hp;
            if(pack.score !== undefined)
                p.score = pack.score;

        }
    }
    for (var i = 0; i < data.bullet.length; i++) {
        var pack = data.bullet[i];
        var b = Bullet.list[pack.id];
        if(b){
            if(pack.x !== undefined)
                b.x = pack.x;
            if(pack.y !== undefined)
                b.y = pack.y;
        }
    }
});

// remove

socket.on('remove', function(data) {
    for (var i = 0; i < data.player.length; i++) {
        delete Player.list[data.player[i]];
    }
    for (var i = 0; i < data.bullet.length; i++) {
        delete Bullet.list[data.bullet[i]];
    }
});

setInterval(function(){
    if(!selfId)
        return;
    ctx.clearRect(0, 0, 500, 500);
    drawMap();
    for (var i in Player.list) {
        Player.list[i].draw();
    }
    for (var i in Bullet.list) {
        Bullet.list[i].draw();
    }
    drawScore();
}, 40);

var drawMap = function(){
    var x = WIDTH / 2 - Player.list[selfId].x;
    var y = HEIGHT / 2 - Player.list[selfId].y;
    ctx.drawImage(Img.map,x,y);
}

var drawScore = function(){
    ctx.fillStyle = "#FFF";
    ctx.fillText(Player.list[selfId].score, 0, 30);
}

socket.on('newPositions', function(data) {
    ctx.clearRect(0, 0, 500, 500);
    for (var i = 0; i < data.player.length; i++) {
        ctx.fillStyle = "#FF0000";
        ctx.beginPath();
        ctx.arc(data.player[i].x, data.player[i].y, 15, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.fillStyle = "#000000";
        ctx.fillText(data.player[i].number, data.player[i].x - 10, data.player[i].y + 10);
    }
    for (var i = 0; i < data.bullet.length; i++) {
        ctx.fillRect(data.bullet[i].x - 5, data.bullet[i].y - 5, 10, 10);
    }

});

document.onkeydown = function(event) {
    if (event.keyCode === 68) //d
        socket.emit('keyPress', {
        inputId: 'right',
        state: true
    });
    if (event.keyCode === 65) //a
        socket.emit('keyPress', {
        inputId: 'left',
        state: true
    });
    if (event.keyCode === 83) //s
        socket.emit('keyPress', {
        inputId: 'down',
        state: true
    });
    if (event.keyCode === 87) //w
        socket.emit('keyPress', {
        inputId: 'up',
        state: true
    });
}

document.onkeyup = function(event) {
    if (event.keyCode === 68) //d
        socket.emit('keyPress', {
        inputId: 'right',
        state: false
    });
    if (event.keyCode === 65) //a
        socket.emit('keyPress', {
        inputId: 'left',
        state: false
    });
    if (event.keyCode === 83) //s
        socket.emit('keyPress', {
        inputId: 'down',
        state: false
    });
    if (event.keyCode === 87) //w
        socket.emit('keyPress', {
        inputId: 'up',
        state: false
    });
    if (event.keyCode >= 49 && event.keyCode <= 53) // 1-5
        socket.emit('weaponMode', event.keyCode);


}

document.onmousedown = function(event) {
    socket.emit('keyPress', {
        inputId: 'click',
        state: true
    });

}

document.onmouseup = function(event) {
    socket.emit('keyPress', {
        inputId: 'click',
        state: false
    });
}

document.onmousemove = function(event) {
    socket.emit('keyPress', {
        inputId: 'clickPosition',
        state: {
            x: event.clientX,
            y: event.clientY
        }
    });
}