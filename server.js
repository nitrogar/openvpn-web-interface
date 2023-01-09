var express = require('express');
var app = express();
const { exec, execFile } = require("child_process");
var fs = require('fs')
const util = require('util');
var ndef = require('ndef');
var net = require("net");



ca = 'placeholder'
ta = 'placeholder'
key = 'placeholder'
cert = 'placeholder'
config_file_template = 
`
client
tls-client
pull
dev tun
proto udp4
remote 165.227.167.144 1194
resolv-retry infinite
nobind
#user nobody
#group nogroup
persist-key
persist-tun
key-direction 1
remote-cert-tls server
auth-nocache
comp-lzo
verb 3
auth SHA512
#tls-auth server/ta.key 1
#ca user/ca.crt
#cert user/user.crt
#key user/user.key
#
ca       [inline]
cert     [inline]
key      [inline]
tls-auth [inline] 1
<ca>
-----BEGIN CERTIFICATE-----%s-----END CERTIFICATE-----
</ca>
<cert>
-----BEGIN CERTIFICATE-----%s-----END CERTIFICATE-----
</cert>
<key>
-----BEGIN PRIVATE KEY-----%s-----END PRIVATE KEY-----
</key>
<tls-auth>
-----BEGIN OpenVPN Static key V1-----%s-----END OpenVPN Static key V1-----
</tls-auth>
`;
function parse_log(callback){
    return exec("cat /etc/openvpn/server/openvpn-status.log | grep CLIENT_LIST", function (error, stdout, stderr) {
        lines = stdout.split("\n");
        lines = lines.slice(1,-1);
        let user = {};
        for(var i = 0 ; i < lines.length;i++){
            l = lines[i].split(",");
            user[l[1]] = {"Real IP":l[2],"Virtual IP":l[3],"since":l[7]}; 
        }
        callback(user);
        

    })

}
function parse_config(name){
    ta = fs.readFileSync("/etc/openvpn/server/ta.key", {encoding:'utf8', flag:'r'});
    ta = ta.split("-----")[2];
        
    ca =  fs.readFileSync(`/etc/openvpn/client/${name}/ca.crt`, {encoding:'utf8', flag:'r'});
    ca = ca.split("-----")[2];
    
    cert = fs.readFileSync(`/etc/openvpn/client/${name}/${name}.crt`, {encoding:'utf8', flag:'r'});
    cert = cert.split("-----")[2];

    key = fs.readFileSync(`/etc/openvpn/client/${name}/${name}.key`, {encoding:'utf8', flag:'r'})
    key = key.split("-----")[2];      
    
    conf = util.format(config_file_template,ca,cert,key,ta);
    return conf;
}
app.get('/',function(req,res){
    res.sendFile("index.html",{root: __dirname });
})
app.get('/Users', function (req, res) {
    exec("ls /etc/openvpn/client", (error, stdout, stderr) => {
        if (error) {
            console.log(`error: ${error.message}`);
            res.send("Service unavailable");
            return;
        }
        res.send(JSON.stringify({"users":stdout.split("\n").slice(0,-1)}));
        return;
    })
})
app.get('/Status', function(req,res){
    var x = parse_log(function(users){
        res.send(JSON.stringify(users));
    });
})
app.get('/NFCWrite/:name' , function(req,res){
    message = [
        ndef.textRecord(req.params.name)
    ];
    
    bytes = ndef.encodeMessage(message);
    buffer = Buffer.from(bytes);

    var s = new net.Socket();
    s.connect(4444, '10.8.0.6');
    s.write(buffer);
    s.end();

    res.redirect('/');
    console.log(buffer);
    console.log(ndef.decodeMessage(bytes));

    





})
app.get('/addUser/:name', function(req, res){
    exec(`mkdir /etc/openvpn/client/${req.params.name};cd /etc/easy-rsa/;EASYRSA_PASSIN=pass:passphrase ./easyrsa build-client-full ${req.params.name} nopass`,
    (error, stdout, stderr) => {
        if(error){
            console.log(`error: ${error.message}`);
            res.send("Service unavailable");
        }
        exec(`cp -rp /etc/easy-rsa/pki/ca.crt /etc/openvpn/client/${req.params.name} ;cp -rp /etc/easy-rsa/pki/issued/${req.params.name}.crt /etc/openvpn/client/${req.params.name};cp -rp /etc/easy-rsa/pki/private/${req.params.name}.key /etc/openvpn/client/${req.params.name}`, function(error,stdout,stderr){
            if(error){
                console.log(`error: ${error.message}`);
                exec('ls /etc/easy-rsa/pki/private/', (e,out,dr) => {console.log(`ls: ${out}`)});
                res.send("Service unavailable");
                return
            }
            res.send(JSON.stringify({"status":"OK"}));
        })    
    })
})
app.get('/removeUser/:name', function(req, res){
    exec(`cd /etc/easy-rsa/;echo "yes" | EASYRSA_PASSIN=pass:passphrase ./easyrsa revoke ${req.params.name}  ; ./easyrsa gen-crl`,
    (error, stdout, stderr) => {
        if(error){
            console.log(`error: ${error.message}`);
            res.send("Service unavailable");
        }
        exec(`cp -rp /etc/easy-rsa/pki/crl.pem /etc/openvpn/server/crl.pem; rm -rf /etc/openvpn/client/${req.params.name};`, function(error,stdout,stderr){
            if(error){
                console.log(`error: ${error.message}`);
                exec('ls /etc/easy-rsa/pki/private/', (e,out,dr) => {console.log(`ls: ${out}`)});
                res.send("Service unavailable");
                return
            }
            res.send(JSON.stringify({"status":"OK"}));
        })    
    })
})
app.get('/UserFile/:name', function(req,res){
                    var conf_file =  parse_config(req.params.name);
                    res.type('txt')
                    //res.set({'Content-Type': 'application/force-download','Content-disposition':`attachment; filename=${req.params.name}.ovpn`});
                    res.send(conf_file);
})    
var server = app.listen(8888,"178.62.33.8", function () {
   var host = server.address().address
   var port = server.address().port
   console.log("Example app listening at http://%s:%s", host, port)
})

