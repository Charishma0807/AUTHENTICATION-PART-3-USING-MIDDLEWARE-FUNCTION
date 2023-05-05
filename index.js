const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const dbPath = path.join(__dirname, "goodreads.db");

const app = express();

app.use(express.json());

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({ filename: dbPath, driver: sqlite3.Database });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(-1);
  }
};
initializeDBAndServer();

//writing a middleware function

const logger = (request, response, next) => {
  console.log(request.query);
  //calling next function
  next();
};

//adding middleware function here
const authenticateToken = (request, response, next) => {
  const authHeader = request.headers["authorization"];
  let jwtToken;
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid Access Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.send("Invalid Access Token");
      } else {
        //console.log(payload);
        //attaching variable to the request object
        request.username = payload.username;
        next();
      }
      //}
    });
  }
};

//Get Books API
//specifying middleware function in an API
//changing logger into authenticateToken

app.get("/books/", authenticateToken, async (request, response) => {
  const getBooksQuery = `
            SELECT
              *
            FROM
             book
            ORDER BY
             book_id;`;
  const booksArray = await db.all(getBooksQuery);
  response.send(booksArray);
});

//Get Book API
app.get("/books/:bookId/", async (request, response) => {
  const authHeader = request.headers["authorization"];
  let jwtToken;
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid Access Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(400);
        response.send("Invalid Access Token");
      } else {
        const { bookId } = request.params;
        const getBookQuery = `
                SELECT
                    *
                FROM
                    book 
                WHERE
                    book_id = ${bookId};
                `;
        const book = await db.get(getBookQuery);
        response.send(book);
      }
    });
  }

  //old code
  // const { bookId } = request.params;
  // const getBookQuery = `
  //   SELECT
  //    *
  //   FROM
  //    book
  //   WHERE
  //    book_id = ${bookId};
  // `;
  // const book = await db.get(getBookQuery);
  // response.send(book);
});

//User Register API
app.post("/users/", async (request, response) => {
  const { username, name, password, gender, location } = request.body;
  const hashedPassword = await bcrypt.hash(request.body.password, 10);
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    const createUserQuery = `
      INSERT INTO 
        user (username, name, password, gender, location) 
      VALUES 
        (
          '${username}', 
          '${name}',
          '${hashedPassword}', 
          '${gender}',
          '${location}'
        )`;
    await db.run(createUserQuery);
    response.send(`User created successfully`);
  } else {
    response.status(400);
    response.send("User already exists");
  }
});

//User Login API
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid User");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid Password");
    }
  }
});

//user profile API

app.get("/profile/", authenticateToken, async (request, response) => {
  //accessing request object
  let { username } = request;
  console.log(username);

  //getting user details from database

  const selectUserQuery = `
    SELECT *
    FROM user
    WHERE 
        username = '${username}';
  `;
  const userDetails = await db.get(selectUserQuery);

  //sending Response
  response.send(userDetails);
});
