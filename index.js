const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const fs = require("fs");
const csv = require("csv");
const e = require("express");

app.use(express.static("assets"));
app.use(express.static("avatars"));

var login_users = {};
var nicknames_avatars_array = [];
var id_avatar = {};
var previousTime = [];
var room_date = new Map();
var id_room = new Map();
var previousRoom_Date = new Map();
var longWord = "";
var react_count = new Map();
var class_counter = new Map();
var allChannels = [];
var room_private = new Map();
var room_nickname = new Map();
var nickname_room = new Map();

fs.createReadStream("./channels.csv").pipe(
  csv.parse({ columns: false }, (err, data) => {
    for (var i = 1; i < data.length; i++) {
      room_nickname.set(data[i][0], "");
      room_private.set(data[i][0], data[i][1]);
      allChannels.push(data[i][0]);
      class_counter.set(data[i][0], 0);
    }
  })
);

fs.createReadStream("./chat.csv").pipe(
  csv.parse({ columns: false }, (err, data) => {
    for (var i = 1; i < data.length; ) {
      if (data[i][3] === "none") {
        i++;
      } else {
        class_counter.set(data[i][2], data[i][4]);
        i++;
      }
    }
  })
);

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/index.html");
});

io.on("connection", (socket) => {
  var previous_msg = "";
  var previous_msg_2 = "";
  socket.on("set nickname avatar", (nickname, whichImage) => {
    login_users[socket.id] = nickname;

    nicknames_avatars_array.push(nickname + "?" + whichImage);
    id_avatar[socket.id] = whichImage;

    io.emit("newcomer joined", nicknames_avatars_array);

    fs.createReadStream("./channels.csv").pipe(
      csv.parse({ columns: false }, (err, data) => {
        for (var i = 1; i < data.length; i++) {
          io.to(socket.id).emit(
            "add-channels",
            data[i][0],
            data[i][1],
            data[i][2]
          );
        }
      })
    );

    socket.on("set roomname", (roomname) => {
      socket.roomname = roomname;
      id_room.set(socket.id, socket.roomname);
      nickname_room.set(login_users[socket.id], roomname); //a=> general , b=>general

      //room_nickname.set(roomname,room_nickname.get(roomname)+",");
      socket.join(socket.roomname);

      var userInGroup = [];
      var groupOfUsers = "";
      var userGone = "";

      function getByValue(map, searchValue) {
        for (let [key, value] of map.entries()) {
          if (value === searchValue) {
            userInGroup.push(key);
          }
        }
        return userInGroup;
      }
      getByValue(nickname_room, roomname);

      for (var i = 0; i < userInGroup.length; i++) {
        groupOfUsers += userInGroup[i] + ",";
      }

      for (let [key, value] of room_nickname.entries()) {
        if (value.includes(login_users[socket.id])) {
          userGone = key;
        }
      }
      if (userGone !== "") {
        var oneLess = room_nickname.get(userGone);
        if (
          oneLess.replace(login_users[socket.id] + ",", "") ===
          room_nickname.get(userGone)
        ) {
          if (
            oneLess.replace("," + login_users[socket.id], "") ===
            room_nickname.get(userGone)
          ) {
            if (
              oneLess.replace(login_users[socket.id], "") !==
              room_nickname.get(userGone)
            ) {
              oneLess = oneLess.replace(login_users[socket.id], "");
            }
          } else {
            oneLess = oneLess.replace("," + login_users[socket.id], "");
          }
        } else {
          oneLess = oneLess.replace(login_users[socket.id] + ",", "");
        }
        room_nickname.set(userGone, oneLess);
      }
      groupOfUsers = groupOfUsers.substring(0, groupOfUsers.length - 1);
      room_nickname.set(roomname, groupOfUsers);
      io.emit("all in group", Array.from(room_nickname));

      fs.createReadStream("./chat.csv").pipe(
        csv.parse({ columns: false }, (err, data) => {
          var messages;
          messages = data;
          for (var i = 1; i < messages.length - 1; i++) {
            if (messages[i + 1][3].includes("none")) {
              var temp;
              temp = messages[i];
              messages[i] = messages[i + 1];
              messages[i + 1] = temp;
            }
          }

          for (var i = 1; i < messages.length; i++) {
            if (messages[i][3].includes("none")) {
              previousRoom_Date.set(messages[i][2], messages[i][1]);
              io.to(socket.id).emit("show_date", messages[i]);
            } else {
              io.to(socket.id).emit("show_chat", messages[i]);
            }
          }
          //////////////////// POMYSL SPRAWDZIC KTORA WARTOSC MA WARTOSC INNA NIZ F I JA USUNAC A POTEM WARTOSC USUNIETA DAC DO PRYWATNEJ. NAPRWAIC Sticker!!!!!!
        })
      );

      fs.createReadStream("./reactions.csv").pipe(
        csv.parse({ columns: false }, (err, data) => {
          for (var i = 1; i < data.length; ) {
            if (data[i][0] != socket.roomname) {
              i++;
            } else {
              io.to(socket.id).emit("print_reaction", data[i][1], data[i][2]);
              i++;
            }
          }
        })
      );
    });

    //io.emit("the number of users", login_users);

    socket.on("disconnect", () => {
      var deletedUser = login_users[socket.id] + "?" + id_avatar[socket.id];

      if (
        room_nickname.get(socket.roomname) != null ||
        room_nickname.get(socket.roomname) != undefined
      ) {
        var byebye = room_nickname.get(socket.roomname);
        byebye = byebye.replace(
          "," + login_users[socket.id] || login_users[socket.id] + ",",
          ""
        );
        room_nickname.set(socket.roomname, byebye);
        io.emit("all in group", Array.from(room_nickname));
      }

      delete login_users[socket.id];

      for (var i = 0; i < nicknames_avatars_array.length; i++) {
        if (nicknames_avatars_array[i].includes(deletedUser)) {
          nicknames_avatars_array.splice(i, 1);
          i--;
        }
      }
      io.emit("newcomer joined", nicknames_avatars_array);
    });

    socket.on("chat message", (msg, time) => {
      var tempArray = [];

      for (var k of time) {
        tempArray.push(k);
      }

      var trimmed = msg.trim();

      if (trimmed.length === 0) {
        return;
      }

      if (trimmed === previous_msg) {
        //同じメッセージが送ったら送られた人にメッセージが表示します
        io.to(socket.id).emit("reject message", trimmed);
        return;
      }

      previous_msg = trimmed;

      var datesString =
        time[0] + "年" + time[1] + "月" + time[2] + "日" + time[3];

      if (room_date.get(socket.roomname) === datesString) {
        if (time[0] === previousTime[0]) {
          time[0] = "";
          if (time[1] === previousTime[1]) {
            time[1] = "";
            if (time[2] === previousTime[2]) {
              time[2] = "";
              time[3] = "";
              /*if(time[4]=previousTime[4] && time[5]-previousTime[5]<=3 &&nickname==previousNickane) !!!trza stworzyc!!{
            add just line to previous message. not a new 
            }*/
            }
          }
        }
      }
      previousRoom = socket.roomname;

      var dateString =
        time[0] + "年" + time[1] + "月" + time[2] + "日" + time[3];

      var dateToCheck =
        time[0] + "年" + time[1] + "月" + time[2] + "日　" + time[3];

      previousTime = tempArray;

      if (
        dateString.length != 3 &&
        previousRoom_Date.get(socket.roomname) != dateToCheck
      ) {
        io.to(socket.roomname).emit("print date", dateString);
      }

      room_date.set(socket.roomname, datesString);

      class_counter.set(
        socket.roomname,
        Number(class_counter.get(socket.roomname)) + 1
      );

      var specialChannel = -1;
      var whatChannel = "";
      var toWhichChannel = "";
      var privacy = "";

      for (var i = 0; i < allChannels.length; i++) {
        if (trimmed.search("#" + allChannels[i]) !== -1) {
          specialChannel = trimmed.search("#" + allChannels[i]);
          whatChannel = "#" + allChannels[i];
          toWhichChannel = allChannels[i];
          privacy = room_private.get(allChannels[i]);
        } else if (trimmed.search("# " + allChannels[i]) !== -1) {
          specialChannel = trimmed.search("# " + allChannels[i]);
          whatChannel = "# " + allChannels[i];
          toWhichChannel = allChannels[i];
          privacy = room_private.get(allChannels[i]);
        }
      }

      if (Number(time[5]) < 10) time[5] = 0 + time[5];

      io.to(socket.roomname).emit("chat message", {
        avatar: id_avatar[socket.id],
        nickname: login_users[socket.id],
        msg: trimmed,
        check: socket.roomname,
        class: class_counter.get(socket.roomname),
        special: specialChannel,
        channel: whatChannel,
        where: toWhichChannel,
        privacy: privacy,
        hour: time[4],
        min: time[5],
      });
    });

    socket.on("add channel", (channel, isPrivate, password) => {
      if (password === null) {
        password = "none";
      }
      fs.appendFile(
        "./channels.csv",
        channel + "," + isPrivate + "," + password + "\r\n",
        function (err) {
          if (err) throw err;
        }
      );
      class_counter.set(channel, 0);
      room_private.set(channel, isPrivate);
      allChannels.push(channel);
      io.emit("add-channels", channel, isPrivate, password);
    });

    socket.on("typing", (data) => {
      //タイピング中
      if (data.typing == 1)
        io.to(socket.roomname).emit(
          "start typing",
          login_users[socket.id],
          socket.roomname
        );
      else
        io.to(socket.roomname).emit(
          "stop typing",
          login_users[socket.id],
          socket.roomname
        );
    });

    socket.on("save-date", (dateToSave) => {
      if (previousRoom_Date.get(socket.roomname) != dateToSave) {
        fs.appendFile(
          "./chat.csv",
          "none" +
            "," +
            dateToSave +
            "," +
            id_room.get(socket.id) +
            "," +
            "none" +
            "," +
            "none" +
            "," +
            "none" +
            "," +
            "none" +
            "\r\n",
          function (err) {
            if (err) throw err;
          }
        );
      }
    });

    socket.on("save", (message, hour, min) => {
      if (message === previous_msg_2 || message.length === 0) {
        return;
      }
      previous_msg_2 = message;

      for (var i = 0; i < allChannels.length; i++) {
        if (message.search("#" + allChannels[i]) !== -1) {
          if (room_private.get(allChannels[i]) === "Y") {
            message =
              '"<hashed onclick=""changeToPrivateRoom(' +
              allChannels[i] +
              ')"">#' +
              allChannels[i] +
              '</hashed>"';
          } else {
            message =
              '"<hashed onclick=""changeRoom(' +
              allChannels[i] +
              ')"">#' +
              allChannels[i] +
              '</hashed>"';
          }
        } else if (message.search("# " + allChannels[i]) !== -1) {
          if (room_private.get(allChannels[i]) === "Y") {
          } else {
            message =
              '"<hashed onclick=""changeToPrivateRoom(' +
              allChannels[i] +
              ')""># ' +
              allChannels[i] +
              '</hashed>"';
          }
        }
      }
      fs.appendFile(
        "./chat.csv",
        login_users[socket.id] +
          "," +
          message +
          "," +
          id_room.get(socket.id) +
          "," +
          id_avatar[socket.id] +
          "," +
          class_counter.get(socket.roomname) +
          "," +
          hour +
          "," +
          min +
          "\r\n",
        function (err) {
          if (err) throw err;
        }
      );
    });

    socket.on("send reaction", (className, source, wasClicked) => {
      longWord += "#" + className + source;

      var howManyReactsPerMessage =
        longWord.split("#" + className + source).length - 1; //w kazdej wiadomosci, kazdy stamp ile razy byl klikany

      var wordlength = "#" + className + source;

      if (wasClicked === true) {
        longWord = longWord.substring(0, longWord.length - wordlength.length);
        longWord = longWord.replace("#" + className + source, "");
        //longWord = longWord.split("#" + className + source).join("");

        howManyReactsPerMessage =
          longWord.split("#" + className + source).length - 1;
      }
      if (howManyReactsPerMessage == "") {
        howManyReactsPerMessage = 0;
      }
      react_count.set(className + "&" + source, howManyReactsPerMessage); // id poloczony z stampem => ilosc klikniec

      var counts = react_count.get(className + "&" + source);

      io.to(socket.roomname).emit(
        "print clicked reaction",
        counts,
        className,
        source
      );
    });

    socket.on("save_reaction", (lastStep, classname) => {
      lastStep = lastStep.replace(/"/g, "#");

      fs.appendFile(
        "./reactions.csv",
        socket.roomname + "," + classname + "," + lastStep + "\r\n",
        function (err) {
          if (err) throw err;
        }
      );
    });

    socket.on("profile-channel", (profile) => {
      var checker = false;
      for (var i = 0; i < allChannels.length; i++) {
        if (
          allChannels[i] === profile + "_" + login_users[socket.id] ||
          allChannels[i] === login_users[socket.id] + "_" + profile
        ) {
          class_counter.set(profile, 0);
          checker = true;
          io.to(socket.id).emit(
            "send DM",
            allChannels[i],
            login_users[socket.id]
          );
        }
      }
      if (!checker) {
        allChannels.push(login_users[socket.id] + "_" + profile);
        class_counter.set(profile, 0);
        fs.appendFile(
          "./channels.csv",
          allChannels[allChannels.length - 1] +
            "," +
            "N" +
            "," +
            "none" +
            "\r\n",
          function (err) {
            if (err) throw err;
          }
        );

        io.to(socket.id).emit(
          "send DM",
          allChannels[allChannels.length - 1],
          login_users[socket.id]
        );
      }
    });

    socket.on("myImage", (myImageUrl, time) => {
      var tempArray = [];

      for (var k of time) {
        tempArray.push(k);
      }

      var datesString =
        time[0] + "年" + time[1] + "月" + time[2] + "日" + time[3];

      if (room_date.get(socket.roomname) === datesString) {
        if (time[0] === previousTime[0]) {
          time[0] = "";
          if (time[1] === previousTime[1]) {
            time[1] = "";
            if (time[2] === previousTime[2]) {
              time[2] = "";
              time[3] = "";
              /*if(time[4]=previousTime[4] && time[5]-previousTime[5]<=3 &&nickname==previousNickane) !!!trza stworzyc!!{
            add just line to previous message. not a new 
            }*/
            }
          }
        }
      }
      previousRoom = socket.roomname;

      var dateString =
        time[0] + "年" + time[1] + "月" + time[2] + "日" + time[3];

      var dateToCheck =
        time[0] + "年" + time[1] + "月" + time[2] + "日　" + time[3];

      previousTime = tempArray;

      if (
        dateString.length != 3 &&
        previousRoom_Date.get(socket.roomname) != dateToCheck
      ) {
        io.to(socket.roomname).emit("print date", dateString);
      }

      room_date.set(socket.roomname, datesString);

      io.to(socket.id).emit("printImg", {
        avatar: id_avatar[socket.id],
        nickname: login_users[socket.id],
        img: myImageUrl,
        check: socket.roomname,
        hour: time[4],
        min: time[5],
      });
    });

    socket.on("image", (imageData, time) => {
      var tempArray = [];

      for (var k of time) {
        tempArray.push(k);
      }

      var datesString =
        time[0] + "年" + time[1] + "月" + time[2] + "日" + time[3];

      if (room_date.get(socket.roomname) === datesString) {
        if (time[0] === previousTime[0]) {
          time[0] = "";
          if (time[1] === previousTime[1]) {
            time[1] = "";
            if (time[2] === previousTime[2]) {
              time[2] = "";
              time[3] = "";
              /*if(time[4]=previousTime[4] && time[5]-previousTime[5]<=3 &&nickname==previousNickane) !!!trza stworzyc!!{
            add just line to previous message. not a new 
            }*/
            }
          }
        }
      }
      previousRoom = socket.roomname;

      var dateString =
        time[0] + "年" + time[1] + "月" + time[2] + "日" + time[3];

      var dateToCheck =
        time[0] + "年" + time[1] + "月" + time[2] + "日　" + time[3];

      previousTime = tempArray;

      if (
        dateString.length != 3 &&
        previousRoom_Date.get(socket.roomname) != dateToCheck
      ) {
        io.to(socket.roomname).emit("print date", dateString);
      }

      room_date.set(socket.roomname, datesString);

      socket.broadcast.emit("image", {
        avatar: id_avatar[socket.id],
        nickname: login_users[socket.id],
        img: imageData,
        check: socket.roomname,
        hour: time[4],
        min: time[5],
      });
    });
  });
});
server.listen(3000, () => {
  console.log("listening on *:3000");
});
