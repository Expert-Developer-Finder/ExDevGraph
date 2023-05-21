import neo4j, { Node, Relationship, Integer, auth } from 'neo4j-driver';
import {  get_file_commit_author_recency, get_file_pr_author_recency, get_file_review_author_recency } from './helpers/index.js';

const getNeo4jCredentials = async (repoId)  => {
    const data = await fetch(`${process.env.SERVER_BASE_URL}/repos/name/${repoId}`);
    const repoFullName = await data.json();

    let uri;
    let user;
    let password;
    if ( repoFullName.owner == "ceydas" && repoFullName.name == "exdev_test") {
        uri = "neo4j+s://eb62724b.databases.neo4j.io:7687"
        user = "neo4j"
        password = "kücük123"
    } else {
        uri =  "neo4j+s://8c4cdf6a.databases.neo4j.io"
        user = "neo4j"
        password = "büyük123"
    }


    return [uri, user, password]
}

export const getRecommendations = async (req, response) => {
    var { source, path, repoId, methodSignature, repo} = req.body;

    if(path[0] == "/") {
        path = path.substring(1);
    }

    var githubRepoCreatedAt = repo.githubRepoCreatedAt;
    var weightCommit = repo.weightCommit;
    var weightPR = repo.weightPR
    var weightRecency = repo.weightRecency;
    var maxDevToBeReturned = repo.devNo

    console.log(`A new query arrived. Query type is ${source}`);
    
    try {
        // connect to neo4j
        let credentials = await getNeo4jCredentials(repoId)
        let uri = credentials[0];
        let user = credentials[1];
        let password = credentials[2];


        
        const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
        const session = driver.session();
        
        const currentDate = new Date();
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1; // add 1 to get 1-12 month range instead of 0-11
        
        var expertsAndScores = [];

        if (source == "file") {
            // Get the commits and recency
            await get_file_commit_author_recency(expertsAndScores, path, session, githubRepoCreatedAt);
            // console.log("AFTER THE COMMIT ERA: ");
            // console.log(expertsAndScores);

            await get_file_pr_author_recency(expertsAndScores, path, session, githubRepoCreatedAt);
            // console.log("AFTER THE PR ERA: ");
            // console.log(expertsAndScores);

            await get_file_review_author_recency(expertsAndScores, path, session, githubRepoCreatedAt);
            // console.log("AFTER THE REVIEW ERA: ");
            // console.log(expertsAndScores);
    
        } else if (source == "folder") { // source is folder
            // Get the commits and recency

             var res = await session.readTransaction(txc =>
                txc.run(
                `WITH $path AS folderPath,
                $year as currentYear,
                $month as currentMonth
                MATCH (fo:Folder {path: folderPath})<-[ifofo:INSIDE_FOFO*0..]-(foChild:Folder)<-[ifofi:INSIDE_FOFI]-(f:File)<-[af:ADDED_FILE]-(n:Commit)-[cb:COMMITED_BY]->(a:Author)
                RETURN a.authorLogin AS AuthorName, COUNT(*) AS CommitCount, SUM(CASE 
                  WHEN n.year = currentYear AND currentMonth-n.month=0  THEN 2
                  WHEN n.year = currentYear AND currentMonth-n.month=1 THEN 1.75
                  WHEN n.year = currentYear AND currentMonth-n.month=2 THEN 1.5
                    WHEN n.year = currentYear AND currentMonth-n.month=3 THEN 1.25
                  ELSE 1
                END) AS TotalScore ORDER BY TotalScore DESC LIMIT 10
                `,
                { path , year, month}
                )
            );

            res.records.forEach((r)=> {
                expertsAndScores.push({
                    "authorName": r._fields[0],
                    "commitCount": r._fields[1].low,
                    "recentCommitScore": typeof( r._fields[2]) == "object"  ? r._fields[2].low: r._fields[2] ,
                    "prKnowAboutScore": 0,
                    "reviewKnowAboutScore": 0,
                    "totalScore" : 0
                })
            });
        
            // Get the prs
            // res = await session.readTransaction(txc =>
            //     txc.run(
            //     `With
            //     $path as filePath 
            //     match(a:Author)<-[spb:SUBMITED_PR_BY]-(p:Pull)<-[cip:CONTAINED_IN_PR]-
            //     (c:Commit)-[af:ADDED_FILE]->(f:File{path:filePath})
            //     return a.authorLogin as AuthorLogin ,p.prNumber as PrNumber,count(cip) as PRknowAboutScore,f.path as FilePath
            //     `,
            //     { path}
            //     )
            // );

            var temp = [];
            // res.records.forEach((r)=> {
            //     temp.push({
            //         "authorName": r._fields[0],
            //         "prNo": r._fields[1],
            //         "prKnowAboutScore": typeof( r._fields[2]) == "object"  ? r._fields[2].low: r._fields[2] 
            //     })
            // });

            res = await session.readTransaction(txc =>
                txc.run(
                `
                with $path as folderPath
                match(a:Author)<-[rb:REVIEWED_BY]-(p:Pull)<-[cip:CONTAINED_IN_PR]-(c:Commit)-[af:ADDED_FILE]->(f:File)-[ifofi:INSIDE_FOFI]->(foChild:Folder)-[ifofo:INSIDE_FOFO*0..]->(fo:Folder{path:folderPath}) return a.authorLogin as AuthorLogin, count(*) as ReviewKnowAboutScore
                `,
                { path}
                )
            );

            res.records.forEach((r)=> {
                for ( var i = 0; i < expertsAndScores.length; i++) {
                    var item = expertsAndScores[i]; 
                    if (item.authorName ==  r._fields[0]){
                        item.reviewKnowAboutScore = typeof( r._fields[1]) == "object"  ? r._fields[1].low: r._fields[1] 
                        added = true
                    } 
                }

            });

            for (var j = 0; j< temp.length; j++) {
                var outerItem = temp[j];
                var added = false;
                for ( var i = 0; i < expertsAndScores.length; i++) {
                    var item = expertsAndScores[i]; 
                    if (item.authorName == outerItem.authorName){
                        item.prKnowAboutScore = item.prKnowAboutScore + outerItem.prKnowAboutScore
                        added = true
                    } 
                }
                if (added == false) {
                    expertsAndScores.push({
                        "authorName": outerItem.authorName,
                        "commitCount": 0, 
                        "recentCommitScore": 0,
                        "prKnowAboutScore": outerItem.prKnowAboutScore,
                        "reviewKnowAboutScore": 0,
                        "totalScore" : 0

                    })
                }

            }

        } else if (source == "method") {
            var index_of_open_bracket = methodSignature.indexOf("(") 
            var trimmedSignature = methodSignature.slice(4, index_of_open_bracket);

            // Method için gereken query buraya gelecek TODO
            res = await session.readTransaction(txc =>
                txc.run(
                `WITH $path as fPath, $trimmedSignature as fName
                MATCH (Method{filePath: fPath, functionName: fName})
                MATCH (author:Author)<-[:COMMITED_BY]-(:Commit)-[commitMod:COMMIT_MODIFIED_METHOD]->(Method)
                WITH Method, author, COUNT(commitMod) as modificationCount
                OPTIONAL MATCH (authorAlso:Author)<-[:COMMITED_BY]-(:Commit)-[commitCreated:COMMIT_CREATED_METHOD]->(Method)
                WHERE authorAlso = author
                WITH  2 as creatingWeight, 1 as modifyWeight, Method, author, modificationCount, authorAlso ,COUNT(commitCreated) as creatorCount
                RETURN author.authorLogin as authorName, Method.functionName as methodName,(CASE WHEN creatorCount > 0 THEN creatingWeight ELSE 0 END) as creatorCount ,modificationCount * modifyWeight as MethodModifyScore, modificationCount * modifyWeight + (CASE WHEN creatorCount > 0 THEN creatingWeight ELSE 0 END) as MethodKnowAboutScore ORDER BY MethodKnowAboutScore DESC LIMIT 3
                `,
                { path, trimmedSignature}
                )
            );
        
            res.records.forEach((r)=> {
                expertsAndScores.push({
                    "authorName": r._fields[0],
                    "creatorCount": r._fields[2].low,
                    "methodModifyScore": r._fields[3].low,
                    "methodKnowAboutScore":  typeof( r._fields[4]) == "object"  ? r._fields[4].low: r._fields[4] ,
                    "totalScore" :  typeof( r._fields[4]) == "object"  ? r._fields[4].low: r._fields[4] ,
                })
            });

        }


        // Calculate the total Scores
        for (var i = 0; i < expertsAndScores.length; i++) {
            if ( source == "method") {
                expertsAndScores[i].totalScore =  expertsAndScores[i].methodKnowAboutScore
            } else {
                var item = expertsAndScores[i];

                // When weight recency is 1, only return the recentScore
                var ultimateCommitScore = ((1- weightRecency) * item.commitCount) + (weightRecency * item.commitRecencyScore)
                var ultimatePRScore = ((1- weightRecency) * item.prCount) + (weightRecency * item.prRecencyScore)
                var ultimateReviewScore = ((1- weightRecency) * item.reviewCount) + (weightRecency * item.reviewRecencyScore)
                var totalScore = (weightCommit * ultimateCommitScore) + (weightPR * (ultimatePRScore + ultimateReviewScore ))
                
                expertsAndScores[i].ultimateCommitScore = ultimateCommitScore
                expertsAndScores[i].ultimatePRScore = ultimatePRScore
                expertsAndScores[i].ultimateReviewScore = ultimateReviewScore
                expertsAndScores[i].totalScore = totalScore
            }
        }

        console.log(`FINALLY, weight recency: ${weightRecency}, weight Commits: ${weightCommit}, weight PRs: ${weightPR} and max experts to be returned: ${maxDevToBeReturned}`);
        console.log(expertsAndScores);

        // Sort by totalScore
        expertsAndScores.sort((a, b) => b.totalScore - a.totalScore);
        console.log("After sorted");
        console.log(expertsAndScores);

        if (expertsAndScores.length > maxDevToBeReturned) {
            expertsAndScores = expertsAndScores.slice(0,maxDevToBeReturned)
        }
        console.log("RESPONSE IS: ");
        console.log(expertsAndScores);

        console.log("Query response has been returned");
        return response.status(200).json(expertsAndScores);
        
    } catch (error) {
        return response.status(404).json([]);
    }


}
