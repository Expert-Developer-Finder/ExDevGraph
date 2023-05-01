import neo4j, { Node, Relationship, Integer, auth } from 'neo4j-driver';
export const getRecommendations = async (req, response) => {
    var { source, path, repoId} = req.body;

    if(path[0] == "/") {
        path = path.substring(1);
    }

    console.log(path);


    try {
        // connect to neo4j
        const uri= process.env.NEO4J_URI;
        const user= process.env.NEO4J_USERNAME;
        const password = process.env.NEO4J_PASSWORD;
        const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
        const session = driver.session();
        
        const currentDate = new Date();
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1; // add 1 to get 1-12 month range instead of 0-11
        
        var commitAndRecency = [];
        var prKnowabout = [];

        let experts =[];
        if (source == "file") {

            // Get the commits and recency
            var res = await session.readTransaction(txc =>
                txc.run(
                `WITH 
                $year as currentYear,
                $month as currentMonth,
                "accounting/yapikredi/2023/yk_totals.py" as filePath
                MATCH(f:File{path:filePath})<-[mf:ADDED_FILE]-(n:Commit)-[cb:COMMITED_BY]->(a:Author)
                RETURN  a.authorLogin as AuthorName,count(cb) as CommitCount,
                SUM(CASE 
                  WHEN n.year = currentYear AND currentMonth-n.month=0  THEN 2
                  WHEN n.year = currentYear AND currentMonth-n.month=1 THEN 1.75
                  WHEN n.year = currentYear AND currentMonth-n.month=2 THEN 1.5
                    WHEN n.year = currentYear AND currentMonth-n.month=3 THEN 1.25
                  ELSE 1
                END) AS TotalRecencyScore ORDER BY TotalRecencyScore DESC LIMIT 5
                `,
                { path , year, month}
                )
            );

            res.records.forEach((r)=> {
                commitAndRecency.push({
                    "authornName": r._fields[0],
                    "commitCount": r._fields[1].low,
                    "recentCommitScore": typeof( r._fields[2]) == "object"  ? r._fields[2].low: r._fields[2] ,
                })
            });


            // Get the prs
            res = await session.readTransaction(txc =>
                txc.run(
                `With
                $path as filePath 
                match(a:Author)<-[spb:SUBMITED_PR_BY]-(p:Pull)<-[cip:CONTAINED_IN_PR]-
                (c:Commit)-[af:ADDED_FILE]->(f:File{path:filePath})
                return a.authorLogin as AuthorLogin ,p.prNumber as PrNumber,count(cip) as PRknowAboutScore,f.path as FilePath
                `,
                { path}
                )
            );

            res.records.forEach((r)=> {
                prKnowabout.push({
                    "authornName": r._fields[0],
                    "prKnowabout": r._fields[2].low,
                })
            });


        } else { // source is folder
            const res = await session.readTransaction(txc =>
                txc.run(
                `
                    MATCH(f:Folder{path: $path}) WITH f 
                    MATCH(f) <-[i:INSIDE_FOFI]-(fi:File)<-[mf:ADDED_FILE]-(c:Commit)-[cb:COMMITED_BY]->(a:Author)  
                    return count(cb) as commit_count, a.authorLogin as commited_by 
                    ORDER BY count(cb) DESC limit 3
                `,
                { path }
                )
            );

            res.records.forEach((r)=> {
                const name = r._fields[1];
                experts.push(name);
            });

        }

        console.log("CIKTI");

        console.log(commitAndRecency);
        console.log(prKnowabout);
        console.log(experts);
        // SORULAR, şu anda n tane öneri varsa n tane adam dönüyo mu
        // şu pr da birden fazla aynı kişiyi farklı pr ile dönüyo mu
        // commit de aynı adam max bir kere gelcek di mi

        var totalScores = {}
        const alpha = 0.5
        for(var i  = 0; i < commitAndRecency.length; i++) {
            var item = commitAndRecency[i];
            totalScores[item.authornName] = alpha * item.commitCount + (1-alpha) * item.recentCommitScore;
        }

        for(var i  = 0; i < prKnowabout.length; i++) {
            var item = prKnowabout[i];
            totalScores[item.authornName] = totalScores[item.authornName] + item.prKnowabout;
        }

        console.log("total scores");
        console.log(totalScores);

        var tempArray = Object.entries(totalScores);
        tempArray.sort(function(first, second) {
            return second[1] - first[1];
        });
        var sortedScores = Object.fromEntries(tempArray);

        // Output the sorted object
        console.log(commitAndRecency);
        console.log(prKnowabout);
        console.log(sortedScores);

        experts = [];
        for (var expName in sortedScores) {
            var commitScore = 0;
            for(var i  = 0; i < commitAndRecency.length; i++) {
                var item = commitAndRecency[i];
                if(item.authornName == expName) {
                    commitScore = alpha * item.commitCount + (1-alpha) * item.recentCommitScore;
                }
            }

            var prScore = 0;
            for(var i  = 0; i < prKnowabout.length; i++) {
                var item = prKnowabout[i];
                console.log(item);
                if(item.authornName == expName) {
                    prScore = item.prKnowabout
                }
            }
            experts.push({
                "name": expName,
                "totalScore":sortedScores[expName],
                "commitScore" : commitScore,
                "prScore" : prScore
            });
        }

        console.log(experts);


        return response.status(200).json(experts);
        
    } catch (error) {
        return response.status(404).json([]);
    }


}
