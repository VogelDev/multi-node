var express = require('express');



var app = express();
app.get('/', function(req, res) {
    res.sendFile(__dirname + '/index.html');
    //res.send('<h1>Nothing to see here!</h1>');
});
app.use('/client', express.static(__dirname + '/client'));



var server = require('http').Server(app);
server.listen(3000, function() {
    console.log('listening on *:3000');
});

var bcrypt = require('bcrypt');
const saltRounds = 12;
var SALT = ''
bcrypt.genSalt(saltRounds, function(err, salt) {
	SALT = salt;
});


var mysql = require('mysql');
var conn = require('./conn');

var pool = mysql.createPool(conn.dbConn);

var io = require('socket.io')(server);

var SOCKET_LIST = {};
var FRAME_RATE = 1000 / 25;
var DEBUG = true;

var Entity = function() {
    var self = {
        x: 250,
        y: 250,
        spdX: 0,
        spdY: 0,
        id: '',
        height: 0,
        width: 0
    }
    self.update = function() {
        self.updatePosition();
    }
    self.updatePosition = function() {
        self.x += self.spdX;
        self.y += self.spdY;
    }
    self.getDistance = function(pt) {
        return Math.sqrt(Math.pow(self.getPosOffset().x - pt.getPosOffset().x, 2) + Math.pow(self.getPosOffset().y - pt.getPosOffset().y, 2));
    }
    self.getPosOffset = function() {
        return {
            x: self.x - self.width / 2,
            y: self.y - self.height / 2
        };
    }

    return self;
}

var Player = function(id) {
    var self = Entity();
    self.id = id;
    self.number = "" + Math.floor(10 * Math.random());
    self.keyPress = {
        right: false,
        left: false,
        down: false,
        up: false,
        click: false,
        clickPosition: {}
    };
    self.maxSpd = 10;
    self.height = 30;
    self.width = 30;
    self.weaponMode = 1
    self.burstCount = 3;
    self.hp = 10;
    self.hpMax = 10;
    self.score = 0;

    var super_update = self.update;
    self.update = function() {
        self.updateSpd();
        super_update();

        if (self.keyPress.click) {
            var angle = self.getShotAngle(self.keyPress.clickPosition);
            switch (self.weaponMode) {
                case 1:
                    self.singleShot(angle);
                    break;
                case 2:
                    self.burstShot(angle);
                    break;
                case 3:
                    self.autoShot(angle);
                    break;
                case 4:
                    self.spreadBurstShot(angle);
                    break;
                case 5:
                    self.spreadAutoShot(angle);
                    break;
            }
        }
    }

    self.singleShot = function(angle) {
        // one shot at a time
        self.keyPress.click = 0;
        self.shootBullet(angle, 100);
    }

    self.autoShot = function(angle) {
        self.shootBullet(angle + Math.random() * 5 - 5, 50);
    }

    self.burstShot = function(angle) {
        if (self.burstCount-- > 0)
            self.shootBullet(angle, 100);
        else
            self.keyPress.click = 0;
    }

    self.spreadBurstShot = function(angle) {
        if (self.burstCount-- > 0) {
            for (var i = -3; i < 3; i++)
                self.shootBullet(i * 10 + angle, 15);
        } else
            self.keyPress.click = 0;
    }

    self.spreadAutoShot = function(angle) {
        for (var i = -3; i < 3; i++)
            self.shootBullet(i * 10 + angle, 15);
    }

    self.getShotAngle = function(clickPosition) {
        var x = -250 + clickPosition.x// - self.x;
        var y = -250 + clickPosition.y// - self.y;
        var angle = Math.atan2(y, x) / Math.PI * 180;
        return angle;
    }

    self.shootBullet = function(angle, life) {
        var b = Bullet(self.id, angle);
        b.life = life
        b.x = self.getPosOffset().x;
        b.y = self.getPosOffset().y;
    }

    self.updateSpd = function() {
        if (self.keyPress.right)
            self.spdX = self.maxSpd;
        else if (self.keyPress.left)
            self.spdX = -self.maxSpd;
        else
            self.spdX = 0;
        if (self.keyPress.down)
            self.spdY = self.maxSpd;
        else if (self.keyPress.up)
            self.spdY = -self.maxSpd;
        else
            self.spdY = 0;

        if (!self.keyPress.click)
            self.burstCount = 3;
    }

    self.getInitPack = function(){
    	return {
	    	id:self.id,
	    	number:self.number,
	    	x:self.getPosOffset().x,
	    	y:self.getPosOffset().y,
		    hp:self.hp,
		    hpMax:self.hpMax,
		    score:self.score
	    }
    }

    self.getUpdatePack = function(){
    	return {
	    	id:self.id,
	    	x:self.getPosOffset().x,
	    	y:self.getPosOffset().y,
		    hp:self.hp,
		    score:self.score
	    }
    }

    Player.list[id] = self;
    initPack.player.push(self.getInitPack());

    return self;
}
Player.list = {};
Player.onConnect = function(socket) {
    var player = Player(socket.id);
    socket.on('keyPress', function(data) {
        player.keyPress[data.inputId] = data.state;
    });
    socket.on('weaponMode', function(data) {
        // offset by 48 because 1 = 49, 2 = 5- etc.
        player.weaponMode = data - 48;
    });
    socket.emit('init',{
    	selfId:socket.id,
    	player:Player.getAllInitPack(),
    	bullet:Bullet.getAllInitPack()
    })
}
Player.getAllInitPack = function(){
    var players = [];
    for(var i in Player.list){
    	players.push(Player.list[i].getInitPack());
    }
    return players;
}
Player.onDisconnect = function(socket) {
    delete Player.list[socket.id];
    removePack.player.push(socket.id);
}
Player.update = function() {
    var pack = [];

    for (var i in Player.list) {
        var player = Player.list[i];
        player.update();
        pack.push(player.getUpdatePack());
    }
    return pack;
}

var Bullet = function(parent, angle) {
    var self = Entity();
    self.id = Math.random();
    self.spdX = Math.cos(angle / 180 * Math.PI) * 10;
    self.spdY = Math.sin(angle / 180 * Math.PI) * 10;
    self.parent = parent;
    self.timer = 0;
    self.toRemove = false;
    self.height = 10;
    self.width = 10;
    self.life = 100;


    var super_update = self.update;
    self.update = function() {
        if (self.timer++ > self.life)
            self.toRemove = true;
        super_update();
        for (var i in Player.list) {
            var p = Player.list[i];
            if (self.parent != p.id && self.getDistance(p) < p.width / 2 + self.width / 2) {
                
            	p.hp--;
            	var shooter = Player.list[self.parent];
            	if(p.hp <= 0){
            		p.hp = p.hpMax;
            		p.x = Math.random() * 500;
            		p.y = Math.random() * 500;
	            	if(shooter){
	            		shooter.score++;
	            	}
            	}

                self.toRemove = true;
            }
        }
    }

    self.getInitPack = function(){
    	return {
	    	id:self.id,
	    	x:self.getPosOffset().x,
	    	y:self.getPosOffset().y
	    }
    }

    self.getUpdatePack = function(){
    	return {
	    	id:self.id,
	    	x:self.getPosOffset().x,
	    	y:self.getPosOffset().y
	    }
    }

    Bullet.list[self.id] = self;
    initPack.bullet.push(self.getInitPack());
    return self;
}
Bullet.list = {};
Bullet.update = function() {
    var pack = [];
    for (var i in Bullet.list) {
        var bullet = Bullet.list[i];
        bullet.update();

        if (bullet.toRemove) {
            delete Bullet.list[i];
            removePack.bullet.push(bullet.id);
        } else {
            pack.push(bullet.getUpdatePack());
        }
    }
    return pack;
}
Bullet.getAllInitPack = function(){
    var bullets = [];
    for(var i in Bullet.list){
    	bullets.push(Bullet.list[i].getInitPack());
    }
    return bullets;
}

var USERS = {
    "bob": "asd"
}

var isValidPassword = function(data, cb) {
    //USERS[data.username] === data.password;

    pool.getConnection(function(err, connection) {
        // Use the connection
        connection.query("SELECT PASSWORD AS password FROM USERS WHERE USERNAME = " + connection.escape(data.username), function(err, rows, fields) {
            if (err) throw err;
 
			cb(bcrypt.compareSync(data.password, rows[0].password)); // true	
            
            // And done with the connection.
            connection.release();
        });
    })
}

var isUsernameTaken = function(data, cb) {
    //return USERS[data.username];

    pool.getConnection(function(err, connection) {
        // Use the connection
        connection.query("SELECT USERNAME AS username FROM USERS WHERE USERNAME = " + connection.escape(data.username), function(err, rows, fields) {
            if (err) throw err;

            cb(rows.length);
            // And done with the connection.
            connection.release();
        });
    })
};

var addUser = function(data, cb) {
    //USERS[data.username] = data.password;

    
        bcrypt.hash(data.password, SALT, function(err, hash) {

		    pool.getConnection(function(err, connection) {
		        // Use the connection
		        var query = "INSERT INTO `USERS` (`USERNAME`, `PASSWORD`) VALUES (" + connection.escape(data.username) + ",'" + hash + "')";
		        console.log(query);
	            connection.query(query, function(err, result) {
	                if (err) throw err;

	                console.log('added');
	                cb();
	            });
	            connection.release();
		    })
        });
    
}

io.sockets.on('connection', function(socket) {
    console.log('user connected');

    SOCKET_LIST[socket.id] = socket;

    socket.on('signIn', function(data) {
        console.log('login attempt');

        isValidPassword(data, function(res) {
            if (res) {
                Player.onConnect(socket);
                console.log(data.username + ' signed in');
                socket.emit('signInResponse', {
                    success: true
                });
            } else {
                socket.emit('signInResponse', {
                    success: false
                });
            }
        });

    });

    socket.on('signUp', function(data) {
        console.log('sign up attempt');
        isUsernameTaken(data, function(res) {
            if (res || data.password.trim() === '') {
            	var error = 'Username taken.';
            	if(data.password.trim() === '')
            		error = "Password cannot be blank."
                socket.emit('signUpResponse', {
                    success: false,
                    err: error
                });
            } else {
                addUser(data, function() {
                    socket.emit('signUpResponse', {
                        success: true
                    });
                });
            }
        });
    });

    socket.on('sendMsgToServer', function(data) {
        if (data[0] === '/' && DEBUG) {
            var res = eval(data.slice(1));
            console.log(res);
        } else {
            var playerName = socket.id.slice(2, 7);
            io.sockets.emit('addToChat', playerName + ': ' + data);
        }
    })

    socket.on('disconnect', function() {
        delete SOCKET_LIST[socket.id];
        Player.onDisconnect(socket);
        console.log('user disconnect');
    });

});

var initPack = {player:[],bullet:[]};
var removePack = {player:[],bullet:[]};



setInterval(function() {

    var pack = {
        player: Player.update(),
        bullet: Bullet.update()
    };
    io.sockets.emit('init', initPack);
    io.sockets.emit('update', pack);
    io.sockets.emit('remove', removePack);
    initPack.player = [];
    initPack.bullet = [];
    removePack.player = [];
    removePack.bullet = [];
    

    //for (var i in SOCKET_LIST) {SOCKET_LIST[i].emit('update', pack);}
    

}, FRAME_RATE);