import neo4j, { Node, Relationship, Integer, auth } from 'neo4j-driver';
import {  get_file_commit_author_recency, get_file_pr_author_recency, get_file_review_author_recency, get_folder_commit_author_recency, get_folder_pr_author_recency, get_folder_review_author_recency, get_method_commit_author_recency, get_method_pr_author_recency, get_method_review_author_recency } from './helpers/index.js';

const getNeo4jCredentials = async (repoId)  => {
    const data = await fetch(`${process.env.SERVER_BASE_URL}/repos/name/${repoId}`);
    const repoFullName = await data.json();

    let uri;
    let user;
    let password;
    if ( repoFullName.owner == "ceydas" && repoFullName.name == "exdev_test") {
        // EXDEV Hesabınınki
        uri = "neo4j+s://eb62724b.databases.neo4j.io:7687"
        user = "neo4j"
        password = "kücük123"

    } else if ( repoFullName.owner == "kondukto-io" && repoFullName.name == "kdt") {
        // BORA'nınki
        uri= "neo4j+s://8a39dd2d.databases.neo4j.io"
        user="neo4j"
        password="ceZS1QmXc5H1w8hSmqAjuVBsRQ4L3icFAVsqIcC1D-0"
    }  else if ( repoFullName.owner == "GlobalMaksimum" && repoFullName.name == "sadedegel") {
        //GLOBAL MAKSİMUM TUNANINKİ
        uri="neo4j+s://deaa0ea2.databases.neo4j.io"
        user="neo4j"
        password="xFh8uvF48csUwAwuDG7LEGqfmH_BxCdLN0wLa9-9nWM"
    }


    return [uri, user, password]
}

export const getRecommendations = async (req, response) => {
    var { source, path, repoId, methodSignature, repo} = req.body;

    console.log(path);

    if(path.indexOf("\\") != -1){
        path = path.replaceAll("\\", "/");
    }

    if(path.indexOf("\\\\") != -1){
        console.log("IF İci");
        path = path.replaceAll("\\\\", "/");
    }

    
    if(path[0] == "/") {
        path = path.substring(1);
    }

    console.log(path);

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
            await get_folder_commit_author_recency(expertsAndScores, path, session, githubRepoCreatedAt);
            console.log("AFTER THE COMMIT ERA: ");
            console.log(expertsAndScores);

            await get_folder_pr_author_recency(expertsAndScores, path, session, githubRepoCreatedAt);
            console.log("AFTER THE PR ERA: ");
            console.log(expertsAndScores);

            await get_folder_review_author_recency(expertsAndScores, path, session, githubRepoCreatedAt);
            console.log("AFTER THE REVIEW ERA: ");
            console.log(expertsAndScores);    

        } else if (source == "method") {
            var index_of_open_bracket = methodSignature.indexOf("(") 
            var trimmedSignature = methodSignature.slice(4, index_of_open_bracket);

            await get_method_commit_author_recency(expertsAndScores, path, trimmedSignature, session, githubRepoCreatedAt);
            console.log("AFTER THE COMMIT ERA: ");
            console.log(expertsAndScores);

            await get_method_pr_author_recency(expertsAndScores, path, trimmedSignature, session, githubRepoCreatedAt);
            console.log("AFTER THE PR ERA: ");
            console.log(expertsAndScores);

            await get_method_review_author_recency(expertsAndScores, path,trimmedSignature, session, githubRepoCreatedAt);
            console.log("AFTER THE REVIEW ERA: ");
            console.log(expertsAndScores);    
        
        
        }


        // Calculate the total Scores
        for (var i = 0; i < expertsAndScores.length; i++) {
            
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
