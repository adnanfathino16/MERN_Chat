import express from "express";
import mongoose from "mongoose";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import cors from "cors";
import bcrypt from "bcryptjs";
import { WebSocketServer } from "ws";
import fs from "fs";
import User from "./app/models/userModel.js";
import Message from "./app/models/messageModel.js";

dotenv.config();
mongoose
  .connect(process.env.MONGO_URL)
  .then(() => {
    console.log("Connected to DB");
  })
  .catch((err) => {
    console.log(err);
  });
const jwtSecret = process.env.JWT_SECRET;
const bcryptSalt = bcrypt.genSaltSync(10);

const app = express();
app.use("/uploads", express.static("uploads"));
app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    credentials: true,
  })
);

const getUserDataFromRequest = async (req) => {
  return new Promise((resolve, reject) => {
    const token = req.cookies?.token;
    if (token) {
      jwt.verify(token, jwtSecret, {}, (err, userData) => {
        if (err) throw err;
        resolve(userData);
      });
    } else {
      reject("no token");
    }
  });
};

app.get("/test", (req, res) => {
  res.json("test ok");
});

app.get("/messages/:userId", async (req, res) => {
  const { userId } = req.params;
  // req keseluruhan untuk menangkap cookie di method ini
  const userData = await getUserDataFromRequest(req);
  const ourUserId = userData.userId;
  const messages = await Message.find({
    sender: { $in: [userId, ourUserId] },
    recipient: { $in: [userId, ourUserId] },
  }).sort({ createAt: 1 });
  res.json(messages);
});

app.get("/people", async (req, res) => {
  const users = await User.find({}, { _id: 1, username: 1 });
  res.json(users);
});

app.get("/profile", (req, res) => {
  const token = req.cookies?.token;
  if (token) {
    jwt.verify(token, jwtSecret, {}, (err, userData) => {
      if (err) throw err;
      res.json(userData);
    });
  } else {
    res.status(401).json("no token");
  }
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const foundUser = await User.findOne({ username });
  if (foundUser) {
    const passOk = bcrypt.compareSync(password, foundUser.password);
    if (passOk) {
      jwt.sign({ userId: foundUser._id, username }, jwtSecret, {}, (err, token) => {
        res.cookie("token", token, { sameSite: "none", secure: true }).json({
          id: foundUser._id,
        });
      });
    }
  }
});

app.post("/logout", async (req, res) => {
  res.cookie("token", "", { sameSite: "none", secure: true }).json("ok");
});

app.post("/register", async (req, res) => {
  const { username, password } = req.body;
  try {
    const hashPW = bcrypt.hashSync(password, bcryptSalt);
    const createUser = await User.create({ username, password: hashPW });
    jwt.sign({ userId: createUser._id, username }, jwtSecret, {}, (err, token) => {
      if (err) throw err;
      res.cookie("token", token, { sameSite: "none", secure: true }).status(201).json({
        id: createUser._id,
      });
    });
  } catch (error) {
    if (error) throw error;
    res.status(500).json("error");
  }
});

const server = app.listen(8000, "0.0.0.0", () => console.log(`Server is running on port 8000`));

const wss = new WebSocketServer({ server });
wss.on("connection", (connection, req) => {
  const notifyAboutOnlinePeople = () => {
    [...wss.clients].forEach((client) => {
      client.send(
        JSON.stringify({
          online: [...wss.clients].map((c) => ({ userId: c.userId, username: c.username })),
        })
      );
    });
  };

  connection.isAlive = true;

  connection.timer = setInterval(() => {
    connection.ping();
    connection.deathTimer = setTimeout(() => {
      connection.isAlive = false;
      clearInterval(connection.timer);
      connection.terminate();
      notifyAboutOnlinePeople();
      // console.log("dead");
    }, 1000);
  }, 5000);

  connection.on("pong", () => {
    clearTimeout(connection.deathTimer);
  });

  // read username and id form the cookie for this connection
  const cookies = req.headers.cookie;
  // console.log(cookies);
  if (cookies) {
    const tokenCookieString = cookies.split(";").length > 1 ? cookies.split(";")[1] : cookies;
    if (tokenCookieString) {
      const token = tokenCookieString.split("=")[1];
      if (token) {
        jwt.verify(token, jwtSecret, {}, (err, userData) => {
          if (err) throw err;
          const { userId, username } = userData;
          connection.userId = userId;
          connection.username = username;
        });
      }
    }
  }
  // console.log([...wss.clients].map((c) => c.username));

  connection.on("message", async (message) => {
    // console.log({ message, isBinary });
    // console.log(typeof message);
    // console.log(message.toString());

    const messageData = JSON.parse(message.toString());
    const { recipient, text, file } = messageData;
    let filename = null;
    if (file) {
      // file itu isinya object seperti file = {name:name, data:data}
      const parts = file.name.split("."); // misal foto.png menjadi [foto, png]
      const ext = parts[parts.length - 1]; //karena length itu dibaca dari 1 maka dikurangi 1 agar mendapat index 1 yaitu png nya
      filename = Date.now() + "." + ext;
      const path = "uploads/" + filename;
      const bufferData = Buffer.from(file.data.split(",")[1], "base64");
      // console.log(bufferData);
      fs.writeFile(path, bufferData, () => {
        console.log("file saved: " + path);
      });
    }
    if (recipient && (text || file)) {
      const messageDoc = await Message.create({
        sender: connection.userId,
        recipient,
        text,
        file: file ? filename : null,
      });
      // console.log("created message");
      // memfilter pengirim pesan (userId) ke yang menerima pesan (recipient) yng sudah diselect sebelumnya di chat apakah sesuai idnya (recipient). ketika sudah tau siapa yang dirim pesannya maka kirim pesannya ke penerima pesan berupa text, siapa pengirimnya (sender), penerimanya (recipient) dan id pesannya yang telah disimpan pada database
      [...wss.clients].filter((c) => c.userId === recipient).forEach((c) => c.send(JSON.stringify({ text, sender: connection.userId, recipient, file: file ? filename : null, _id: messageDoc._id })));
      // menggunakan _id karena ketika nanti di client penerima (recipient) dapat menggunakan uniqBy sesuai dengan _id nya jika mengguanakan id saja maka nanti ketika client yang mengirim pesan baru maka tidak akan sama dengan yang ada di database karena di database menggunakan _id
    }
  });

  // notify everyone about online people (when someone connects)
  notifyAboutOnlinePeople();
});
