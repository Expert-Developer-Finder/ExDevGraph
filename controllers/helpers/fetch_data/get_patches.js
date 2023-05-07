import fs from "fs";
import axios from "axios";
import { sleep } from "../helpers.js";

const hashRegex = /^From (\S*)/;
const authorRegex = /^From:\s?([^<].*[^>])?\s+(<(.*)>)?/;
const fileNameRegex = /^diff --git "?a\/(.*)"?\s*"?b\/(.*)"?/;
const fileLinesRegex = /^@@ -([0-9]*),?\S* \+([0-9]*),?/;
const similarityIndexRegex = /^similarity index /;
const addedFileModeRegex = /^new file mode /;
const deletedFileModeRegex = /^deleted file mode /;

function parseGitPatch(patch) {
  if (typeof patch !== "string") {
    throw new Error("Expected first argument (patch) to be a string");
  }
  const lines = patch.split("\n");
  const hashLine = lines.shift();
  if (!hashLine) return null;
  const match1 = hashLine.match(hashRegex);
  if (!match1) return null;
  const [, hash] = match1;
  const authorLine = lines.shift();
  if (!authorLine) return null;
  const match2 = authorLine.match(authorRegex);
  if (!match2) return null;
  const [, authorName, , authorEmail] = match2;
  const dateLine = lines.shift();
  if (!dateLine) return null;
  const [, date] = dateLine.split("Date: ");
  const messageLine = lines.shift();
  if (!messageLine) return null;
  const [, message] = messageLine.split("Subject: ");
  const parsedPatch = {
    hash,
    authorName,
    authorEmail,
    date,
    message,
    files: [],
  };
  splitIntoParts(lines, "diff --git").forEach((diff) => {
    const fileNameLine = diff.shift();
    if (!fileNameLine) return;
    const match3 = fileNameLine.match(fileNameRegex);
    if (!match3) return;
    const [, a, b] = match3;
    const metaLine = diff.shift();
    if (!metaLine) return;
    const fileData = {
      added: false,
      deleted: false,
      beforeName: a.trim(),
      afterName: b.trim(),
      modifiedLines: [],
    };
    parsedPatch.files.push(fileData);
    if (addedFileModeRegex.test(metaLine)) {
      fileData.added = true;
    }
    if (deletedFileModeRegex.test(metaLine)) {
      fileData.deleted = true;
    }
    if (similarityIndexRegex.test(metaLine)) {
      return;
    }
    splitIntoParts(diff, "@@ ").forEach((lines) => {
      const fileLinesLine = lines.shift();
      if (!fileLinesLine) return;
      const match4 = fileLinesLine.match(fileLinesRegex);
      if (!match4) return;
      const [, a, b] = match4;
      let nA = parseInt(a);
      let nB = parseInt(b);
      lines.forEach((line) => {
        nA++;
        nB++;
        if (line.startsWith("-- ")) {
          return;
        }
        if (line.startsWith("+")) {
          nA--;
          fileData.modifiedLines.push({
            added: true,
            lineNumber: nB,
            line: line.substr(1),
          });
        } else if (line.startsWith("-")) {
          nB--;
          fileData.modifiedLines.push({
            added: false,
            lineNumber: nA,
            line: line.substr(1),
          });
        }
      });
    });
  });
  return parsedPatch;
}


function splitIntoParts(lines, separator) {
  const parts = [];
  let currentPart;
  lines.forEach((line) => {
    if (line.startsWith(separator)) {
      if (currentPart) {
        parts.push(currentPart);
      }
      currentPart = [line];
    } else if (currentPart) {
      currentPart.push(line);
    }
  });
  if (currentPart) {
    parts.push(currentPart);
  }
  return parts;
}

async function get_patches(
  pulls_path,
  patch_path,
  tokens,
  repo_owner,
  repo_name,
  log_path
) {
  console.log("Fetching patches started");
  var token_no= 0 ;
  //TODO: Make the graph.js output a valid json.
  var f = fs.readFileSync(pulls_path, "utf-8");
  const pullsLinesSplitted = f.split(/\r?\n/);

  //Do not take non merged prs

  var fetched_patches = "[";

  var i = 0;
  for (var line of pullsLinesSplitted) {
    if (line.length) {
      i++;
      var pr = JSON.parse(line);
      if (pr.number % 10 == 0) {
        console.log(`Fetching patch for issue number ${pr.number}`);
        fs.appendFileSync(log_path,`Fetching patch for issue number ${pr.number}\n` );
        
      }
      if (pr.pull_request.merged_at === null) {
        continue;
      }

      var okToGo = false
      while (okToGo == false) {
        okToGo = true;

        try {
          const config = {
            headers: { Authorization: `Bearer ${tokens[token_no]}` }, //TODO: Prepare Multiple token
          };
  
          var { data } = await axios.get(
            "https://patch-diff.githubusercontent.com/raw/" +
              repo_owner +
              "/" +
              repo_name +
              "/pull/" +
              pr.number +
              ".patch",
            config
          );
          
        } catch (e) {
          okToGo = false;
          if(e.response.status == 403 ) {
            fs.appendFileSync(log_path, `PATCH: TOKEN ${tokens[token_no]} WAS OVER! We changed the token and moved on!\n`);
            console.log(`nPATCH: TOKEN ${tokens[token_no]} WAS OVER! We changed the token and moved on!\n`);
            token_no += 1;
            token_no = token_no % tokens.length
  
            // if we have tried every token, let's wait for 15 minutes before trying again
            if(token_no == 0) {
              fs.appendFileSync(log_path, `PATCH: ALL TOKENS WERE OVER! Sleeping for 15 minutes. Sleeping time ${new Date()} \n`);
              console.log( `PATCH: ALL TOKENS WERE OVER! Sleeping for 15 minutes. Sleeping time ${new Date()} \n`);
              await sleep(60000*15); 
              fs.appendFileSync(log_path, `\nPATCH: Waking up. time:  ${new Date()} \n`);
              console.log(`PATCH: Waking up. time:  ${new Date()} \n`);
            }
          } else {
              // might be a server error or something else might have gone wrong
              fs.appendFileSync(log_path, `\nPATCH: Something went wrong! ${e.message} \n`);
              console.log( `PATCH: Something went wrong! ${e.message} \n`);
          } 
        }
      }
      
      //Somehow divide multiple commit patch data
      var fArr = data.split(/(From \w{40} )/g);
      var concatFArr = [];
      for (let i = 0; i < (fArr.length - 1) / 2; i++) {
        const element = fArr[i * 2 + 1] + fArr[i * 2 + 2];
        concatFArr[i] = element;
      }
      concatFArr.forEach((element, index) => {
        concatFArr[index] = parseGitPatch(element);
      });

      pr["patch"] = concatFArr;

      if (i === pullsLinesSplitted.length - 1) {
        fetched_patches = fetched_patches + JSON.stringify(pr);
      } else {
        fetched_patches = fetched_patches + JSON.stringify(pr) + ",\n";
      }
    }
  }


  var fetched_patches = fetched_patches + "]";
  fs.appendFileSync(patch_path, fetched_patches);
  console.log( "Patches have been fetched");
  fs.appendFileSync(log_path, "Patches have been fetched");
}

export {get_patches}

