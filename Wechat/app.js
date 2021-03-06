/**
 * 微信后台
 */

var http = require('http');
var https = require('https');
var crypto = require('crypto');
var url = require('url');
var querystring = require('querystring');
var xml2js = require('xml2js');
var fs = require('fs');

// 微信账号信息
var wechatConfig = {
    appid : 'wx29564eaf67e22491',
    appsecret : '26d6677307ba0bf5dfa45a0b8a0f958b',
    token : 'Pa888888',
    wechatUrl : 'sz.api.weixin.qq.com',
    access_token : 'sTskAZw0XYGBbISSrENlo_UvOCba69CGj2LtZAe5LhVbjadj8fwRIKXXiv1Wtv4JQ9vJ8aoCx5ARX_UnubWVubgOC5f-dLscEimDlZ8zQMdouaNnaiHlPd2bho5pFdOWBJJfACATBB'
};

// 页面授权信息
var pageAuthorizationInfo = {
    access_token : '',
    refresh_token : ''
};

http.createServer(function(req, res) {
    var urlParse = url.parse(req.url);
    var urlPathname = urlParse.pathname;
    var urlQuery = querystring.parse(urlParse.query);

    // 微信发起的请求
    if (urlPathname === '/server') {
        // 验证服务器地址的有效性
        // http://28cf2399.ngrok.natapp.cn/checkSignature?signature=f31b8b749778cffabe02e004b0a4d363db389545&timestamp=aaa&nonce=bbb&echostr=abc
        if (req.method === 'GET' && urlQuery.echostr) {
            var result = '';
            var token = wechatConfig.token;
            var signature = urlQuery.signature;
            var timestamp = urlQuery.timestamp;
            var nonce = urlQuery.nonce;
            var str = [token, timestamp, nonce].sort().join('');
            var selfSignature = crypto.createHash('sha1').update(str).digest('hex');
            if (selfSignature === signature) {
                result = urlQuery.echostr;
            }
            res.writeHead(200, {'Content-Type': 'text/plain'});
            res.end(result);
        }

        // 消息
        else if (req.method === 'POST') {
            // 自动回复
            var content = '';
            req.on('data', function (chunk) {
                content += chunk;
            });
            req.on('end', function () {
                xml2js.parseString(content, function(err, result) {
                    console.log('将xml转换为JS对象:');
                    console.log(result.xml);
                    var replyObj = {
                        ToUserName: result.xml.FromUserName[0],
                        FromUserName: result.xml.ToUserName[0],
                        CreateTime: +new Date(),
                        MsgType: 'text',
                        Content: '[自动回复]' + result.xml.Content[0]
                    };
                    var builder = new xml2js.Builder({
                        rootName: 'xml',
                        cdata: true
                    });
                    var replyXml = builder.buildObject(replyObj);
                    res.writeHead(200, {'Content-Type': 'text/plain'});
                    res.end(replyXml);
                });
            });
        }
    }

    // 网页授权:通过code换取网页授权access_token及openid
    else if (urlPathname === '/server/pageAuthorization/getOpenId') {
        var code = urlQuery.code;
        if (code) {
            pageAuthorization.getAccessToken(code, function(data) {
                if (data.errcode) {
                    var result = {
                        'responseCode': data.errcode,
                        'responseMsg': data.errmsg
                    };
                    res.writeHead('200', {'Content-Type': 'application/json'});
                    res.end(JSON.stringify(result));
                } else if (data.openid) {
                    var result = {
                        'responseCode': 0,
                        'data': {
                            'openid': data.openid
                        },
                        'responseMsg': '成功.'
                    };
                    res.writeHead('200', {'Content-Type': 'application/json'});
                    res.end(JSON.stringify(result));
                }
            });
        } else {
            var result = {
                'responseCode': 1,
                'responseMsg': '入参缺少code'
            };
            res.writeHead('200', {'Content-Type': 'application/json'});
            res.end(JSON.stringify(result));
        }
    }

    // 网页授权:通过openid获取用户基本信息
    else if (urlPathname === '/server/pageAuthorization/getUserInfo') {
        var openid = urlQuery.openid;
        if (openid) {
            pageAuthorization.getUserInfo(openid, function(data) {
                if (data.errcode) {
                    var result = {
                        'responseCode': data.errcode,
                        'responseMsg': data.errmsg
                    };
                    res.writeHead('200', {'Content-Type': 'application/json'});
                    res.end(JSON.stringify(result));
                } else {
                    var result = {
                        'responseCode': 0,
                        'data': data,
                        'responseMsg': '成功.'
                    };
                    res.writeHead('200', {'Content-Type': 'application/json'});
                    res.end(JSON.stringify(result));
                }
            });
        } else {
            var result = {
                'responseCode': 1,
                'responseMsg': '入参缺少openid'
            };
            res.writeHead('200', {'Content-Type': 'application/json'});
            res.end(JSON.stringify(result));
        }
    }

    // 输出前端资源
    else {
        var filePath = './pages' + urlPathname;
        // HTML文件
        if (urlPathname.split('.').slice(-1)[0] === 'html') {
            fs.readFile(filePath, function(err, data) {
                res.writeHead(200, {'Content-Type': 'text/html'});
                res.end(data);
            });
        }
        // JS文件
        else if (urlPathname.split('.').slice(-1)[0] === 'js') {
            fs.readFile(filePath, function(err, data) {
                res.writeHead(200, {'Content-Type': 'application/javascript; charset=utf-8'});
                res.end(data);
            });
        }
        // 其它
        else {
            fs.readFile(filePath, function(err, data) {
                res.writeHead(200, {'Content-Type': 'text/plain'});
                res.end(data);
            });
        }
    }
}).listen(3000);

console.log('服务器已启动，地址是：http://127.0.0.1:3000');

// 获取access_token
// https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=APPID&secret=APPSECRET
function getAccessToken() {
    var requestUrl = 'https://' + wechatConfig.wechatUrl + '/cgi-bin/token?grant_type=client_credential&appid=' + wechatConfig.appid + '&secret=' + wechatConfig.appid;
    var options = {
        host: wechatConfig.wechatUrl,
        path: '/cgi-bin/token?' + querystring.stringify({
            grant_type: 'client_credential',
            appid: wechatConfig.appid,
            secret: wechatConfig.appsecret
        })
    };
    https.get(options, function(res) {
        var body = '';
        res.on('data', function(d) {
            body += d;
        });
        res.on('end', function() {
            var parsed = JSON.parse(body);
            if (!parsed.errcode) {
                wechatConfig.access_token = parsed.access_token;
                console.log('access_token变更为: ' + wechatConfig.access_token);
                setTimeout(getAAccessToken, (parsed.expires_in || 7200) * 1000 - 200 * 1000);
            } else {
                console.log('获取access_token失败,详情如下: ');
                console.log(parsed);
            }
        });
    }).on('error', function(e) {
        console.error(e);
    });
}
// getAccessToken();

// 网页授权
var pageAuthorization = {
    // 通过code换取网页授权access_token
    getAccessToken: function(code, callback) {
        var url = 'https://api.weixin.qq.com/sns/oauth2/access_token?appid=' + wechatConfig.appid + '&secret=' + wechatConfig.appsecret + '&code=' + code + '&grant_type=authorization_code';
        https.get(url, function(res) {
            var text = '';
            res.on('data', function(d) {
                text += d;
            });
            res.on('end', function() {
                console.log('微信返回的数据结果: ' + text);
                var data = JSON.parse(text);
                pageAuthorizationInfo.access_token = data.access_token;
                pageAuthorizationInfo.refresh_token = data.refresh_token;
                // todo 7200秒后,自动刷新access_token
                callback && callback(data);
            });
        });
    },
    getUserInfo: function(openid, callback) {
        var url = 'https://api.weixin.qq.com/sns/userinfo?access_token=' + pageAuthorizationInfo.access_token + '&openid=' + openid + '&lang=zh_CN';
        https.get(url, function(res) {
            var text = '';
            res.on('data', function(d) {
                text += d;
            });
            res.on('end', function() {
                console.log('微信返回的数据结果: ' + text);
                var data = JSON.parse(text);
                callback && callback(data);
            });
        });
    }
}
