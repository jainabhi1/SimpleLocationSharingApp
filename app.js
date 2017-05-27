var express = require('express');
var path = require('path');
var redis = require('redis')
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var session = require('express-session');
var Sync = require('sync');

var client = redis.createClient({host : 'localhost', port : 6379});

client.on('connect',function(){
	console.log('running redis');
});

var app = express();
app.use(bodyParser.urlencoded({ extended: false })) 

app.use(bodyParser.json());
app.use(cookieParser());
app.use(session({secret: "Shh, its a secret!"}));


app.listen(3000);
var temp = 0;
app.get('/',function(req,res){
	if(req.session.uname)
		return res.redirect('/home');
	console.log(req.session);
   res.sendFile(path.join(__dirname+'/index.html'));
});
//login function
app.get('/login',function(req,res){
	if(req.session.uname)
		return res.redirect('/home');
	console.log(req.session);
	res.sendFile(path.join(__dirname+'/login.html'));
});
//signup fnction
app.get('/signup',function(req,res){
	if(req.session.uname)
		return res.redirect('/home');
	console.log(req.session);
	res.sendFile(path.join(__dirname+'/signup.html'));
});
//authentication method
app.post('/check',function(req,res){
	console.log(req.body);
	let uname = req.body.uname;
	let psw = req.body.password;
	let flag = 0;
	console.log(psw);
	client.get(uname,function(err, object) {
    	if(object != psw)
    	{
    		flag = 1;
    	}
    	if(flag == 1)
    		res.redirect('/login');
    	else
    	{
    		req.session.uname=uname;
    		res.redirect('/home');
    	}

	});
});
// it will create new user
app.post('/newuser',function(req,res){
	let uname = req.body.uname;
	let psw = req.body.psw;
	client.set(uname,psw,function(err, object){
		console.log(err);
	});
	req.session.uname=uname;
	res.redirect('/home');
});
//get the session owners name
app.get('/getuser',function(req,res){
	res.send(req.session.uname);
});
//this method redirects to starttrip form
app.get('/newtrip',function(req,res){
	if(!req.session.uname)
		return res.redirect('/');
	res.sendFile(path.join(__dirname+'/starttrip.html'));
});

function randomString(length, chars) {
    var result = '';
    for (var i = length; i > 0; --i) result += chars[Math.floor(Math.random() * chars.length)];
    return result;
}
//this method starts a new trip
app.post('/startnewtrip',function(req,res){
	var lat = req.body.id1;
	var log = req.body.id2;
	var time = new Date().toString();
	var arr = {st:{'lat':lat,'log':log,'time':time},end:{
		'lat':'9999','log':'9999','time':'9999'}
	};
	var rString = randomString(10
	, '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ');
	var data = JSON.stringify(arr);
	let uname = req.session.uname+"trip";
	client.set(uname,rString,function(err, object){
		console.log(err);
	});
	client.set(rString,data,function(err, object){
		console.log(err);
	});
	res.redirect("/show?e="+rString);
	
})

app.get('/curtrip',function(req,res){
	if(!req.session.uname)
		return res.redirect('/');
	var cur;
	client.get(req.session.uname+"trip",function(err,object){
		cur = object;
		res.redirect('/show?e='+cur);
	})
	
});
//show page
app.get('/show',function(req,res){
	if(!req.session.uname)
		return res.redirect('/');
	let uname = req.session.uname+"trip";
	client.get(uname,function(err,object){
		console.log(err);
		if(object == null)
			res.redirect('/home');
		else
			res.sendFile(path.join(__dirname+'/show.html'));
	});
});

app.get('/getCoordinates',function(req,res){
	let query = req.query.e;
	console.log(query);
	client.get(query,function(err,object){
			res.setHeader('content-type', 'application/json');
			res.send(object);		
	});
});

app.get('/view',function(req,res){
	let query = req.query.e;
	if(!query)
		return res.send("bad address");
	client.get(query,function(err,object){
		console.log(err);
		if(object == null)
			res.send('bad address');
		else
			res.sendFile(path.join(__dirname+'/view.html'));
	});
});
//This is the home page if user is logged in
app.get('/home',function(req,res){
	console.log(req.session);
	if(!req.session.uname)
		return res.redirect('/');
	res.sendFile(path.join(__dirname+'/hello.html'));
});

app.get('/live',function(req,res){
	if(!req.session.uname)
		return res.redirect('/');
	client.get(req.session.uname+"trip",function(err,object){
		console.log(object);
		if(object == null)
			res.send('no');
		else
			res.send('yes');
	});
});

app.post('/endtrip',function(req,res){
	let name = req.session.uname;
	var trip;
	client.get(name+"trip",function(err,object){
		trip = object;
		client.get(trip,function(err1,object1){
			var t = JSON.parse(object1);
			t.end.lat=req.body.id1;
			t.end.log=req.body.id2;
			t.end.time = new Date().toString(); 
			t=JSON.stringify(t);
			client.lpush(name+"list",trip,function(err2,object2){
				console.log(err);
			});
			client.set(trip,t,function(err3,object3){
				console.log(err);
			});
			client.del(name+"trip",function(err4,object4){
				console.log(err);
			});
		});
	});
	res.redirect("/home");
});
var t = function(query,arr){
	client.get(query,function(err,obj){
				//console.log(obj);
				//console.log(query);
				arr[query]=JSON.parse(obj);
			});
}
app.get('/viewtrips',function(req,res){
	let query = req.query.user;
	var arr={};
	var count=0;
	res.setHeader('content-type', 'application/json');
	client.lrange(query+"list",0,-1,function(err,object){
		for(var key in object){
			var query1 = object[key];
			t(query1,arr);
		}
		
	});

	setTimeout(function() { console.log(arr); res.send(arr); }, 100);
});
app.get('/prevtrips',function(req,res){
	let query = req.query.user;
	client.get(query,function(err,object){
		if(object == null)
			return res.send('<h1> No user exist<h1>');
	});
	res.sendFile(path.join(__dirname+'/viewtrips.html'));
});	