import fs from "fs"
import path from "path"
import axios from "axios"

//TODO do this non hard coded way
var pulls_path = 'data/chaoss/grimoirelab-perceval/pulls.json'
var repo_owner = "chaoss"
var repo_name = "grimoirelab-perceval"
var tokens = ["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"]
const patch_path = `./data/${repo_owner}/${repo_name}/patches.json`;

const hashRegex = /^From (\S*)/;
const authorRegex = /^From:\s?([^<].*[^>])?\s+(<(.*)>)?/;
const fileNameRegex = /^diff --git "?a\/(.*)"?\s*"?b\/(.*)"?/;
const fileLinesRegex = /^@@ -([0-9]*),?\S* \+([0-9]*),?/;
const similarityIndexRegex = /^similarity index /;
const addedFileModeRegex = /^new file mode /;
const deletedFileModeRegex = /^deleted file mode /;
function parseGitPatch(patch) {
    if (typeof patch !== 'string') {
        throw new Error('Expected first argument (patch) to be a string');
    }
    const lines = patch.split('\n');
    const hashLine = lines.shift();
    if (!hashLine)
        return null;
    const match1 = hashLine.match(hashRegex);
    if (!match1)
        return null;
    const [, hash] = match1;
    const authorLine = lines.shift();
    if (!authorLine)
        return null;
    const match2 = authorLine.match(authorRegex);
    if (!match2)
        return null;
    const [, authorName, , authorEmail] = match2;
    const dateLine = lines.shift();
    if (!dateLine)
        return null;
    const [, date] = dateLine.split('Date: ');
    const messageLine = lines.shift();
    if (!messageLine)
        return null;
    const [, message] = messageLine.split('Subject: ');
    const parsedPatch = {
        hash,
        authorName,
        authorEmail,
        date,
        message,
        files: [],
    };
    splitIntoParts(lines, 'diff --git').forEach(diff => {
        const fileNameLine = diff.shift();
        if (!fileNameLine)
            return;
        const match3 = fileNameLine.match(fileNameRegex);
        if (!match3)
            return;
        const [, a, b] = match3;
        const metaLine = diff.shift();
        if (!metaLine)
            return;
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
        splitIntoParts(diff, '@@ ').forEach(lines => {
            const fileLinesLine = lines.shift();
            if (!fileLinesLine)
                return;
            const match4 = fileLinesLine.match(fileLinesRegex);
            if (!match4)
                return;
            const [, a, b] = match4;
            let nA = parseInt(a);
            let nB = parseInt(b);
            lines.forEach(line => {
                nA++;
                nB++;
                if (line.startsWith('-- ')) {
                    return;
                }
                if (line.startsWith('+')) {
                    nA--;
                    fileData.modifiedLines.push({
                        added: true,
                        lineNumber: nB,
                        line: line.substr(1),
                    });
                }
                else if (line.startsWith('-')) {
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
    lines.forEach(line => {
        if (line.startsWith(separator)) {
            if (currentPart) {
                parts.push(currentPart);
            }
            currentPart = [line];
        }
        else if (currentPart) {
            currentPart.push(line);
        }
    });
    if (currentPart) {
        parts.push(currentPart);
    }
    return parts;
}

export async function fetchPatchData(pulls_path, patch_path, tokens) {

    console.log("Patch collection started")
    //This is definely not the best way to read this file.
    //But the file is not a valid json.
    //Need for a valid json file
    //TODO: Make the graph.js output a valid json.
    var f = fs.readFileSync(pulls_path, 'utf-8')
    f = JSON.parse(f.toString())
    //Do not take non merged prs
    f = f.filter(pr => pr.pull_request.merged_at != null)

    var fetched_patches = "["

    var i = 0
    for (const pr of f) {

        //console.log(pr.pull_request.patch_url)
        const config = {
            headers: { Authorization: `Bearer ${tokens[0]}` }, //TODO: Prepare Muliple token 
        };
        console.log()
        var { data } = await axios.get(
            "https://patch-diff.githubusercontent.com/raw/chaoss/grimoirelab-perceval/pull/" + pr.number + ".patch",
            config
        );
        //console.log(data)
        //Somehow divide mulitple commit patch data
        var fArr = data.split(/(From \w{40} )/g)
        var concatFArr = []
        for (let i = 0; i < (fArr.length - 1) / 2; i++) {
            const element = fArr[i * 2 + 1] + fArr[i * 2 + 2];
            concatFArr[i] = element
        }
        concatFArr.forEach((element, index) => {
            console.log(pr.number + "//" + index)
            concatFArr[index] = parseGitPatch(element)
        });
        //console.log(concatFArr)
        pr["patch"] = concatFArr
        i++
        if (i === f.length) {
            console.log("last")
            fetched_patches = fetched_patches + JSON.stringify(pr)
        }
        else {
            fetched_patches = fetched_patches + JSON.stringify(pr) + ",\n"
        }
    }

    var fetched_patches = fetched_patches + "]"
    fs.appendFileSync(patch_path, fetched_patches)
}

export async function graph_pulls_create(path_patches, session) {
    //MERGE PRS
    const pullsLines = JSON.parse(fs.readFileSync(path_patches, 'utf-8'));
    const maxCount = pullsLines.length
    var currentCount = 0
    for (var pr of pullsLines) {
        currentCount++
        console.log(`Uploading PR Data $currentCount / $maxCount`, { currentCount, maxCount })
        var prDate = pr.closed_at
        var prTitle = pr.title
        var prNumber = pr.number

        try {
            //Create Pull node
            const res1 = await session.executeWrite(
                tx => tx.run(`
                CREATE (u:Pull{
                    prNumber: $prNumber,
                    prTitle: $prTitle,
                    prDate: $prDate
                })RETURN u`,
                    { prNumber, prTitle, prDate }));

            //Create connections for every commit and author
            for (const patch of pr.patch) {
                var prAuthorName = patch.authorName
                var prAuthorEmail = patch.authorEmail
                var commit = patch.hash

                //Create (Pull)-[SUBMITED_PR_BY]->(Author) relation
                const res2 = await session.executeWrite((tx) =>
                    tx.run(`
                MATCH (a:Author {authorName: $prAuthorName})
                MATCH (p:Pull {prNumber: $prNumber})
                MERGE (p)-[:SUBMITED_PR_BY]->(a)`,
                        { prAuthorName, prNumber }
                    ));

                //Create (Commit)-[CONTAINED_IN_PR]->(Pull) relation
                const res3 = await session.executeWrite((tx) =>
                    tx.run(`
                MATCH (p:Pull {prNumber: $prNumber})
                MATCH (c:Commit {hash: $commit})
                MERGE (c)-[:CONTAINED_IN_PR]->(p)`,
                        { prNumber, commit }));
            }

        } catch (error) {
            console.log("PR data upload failed. Issue Number: " + prNumber)
            console.log(error)
        }
    }
}

//fetchPatchData(pulls_path, patch_path, tokens)

