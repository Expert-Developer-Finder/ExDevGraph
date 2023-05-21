const get_method_review_author_recency = async (expertsAndScores, path, signatureName, session, githubRepoCreatedAt) => {
    var startDateStr =  Date.parse(githubRepoCreatedAt)
    var todayDateStr =  Date.now()

    var startDate = parseInt(startDateStr);
    var todayDate = parseInt(todayDateStr);

    var key = `${path}/${signatureName}`
    console.log("M3 KEY IS " + key);

    var res = await session.readTransaction(txc =>
        txc.run(
       `
        MATCH(m:Method{key: $key})<-[cm]-(c:Commit)-[cpr:CONTAINED_IN_PR]->(p:Pull) WITH DISTINCT p.prNumber as prNum
        MATCH (a:Author)<-[spb:REVIEWED_BY]-(p:Pull{prNumber: prNum})
        WITH a,spb,p ,(1- ( $todayDate- p.prDate) / ($todayDate - $startDate )) AS recency
        RETURN a.authorLogin as AuthorLogin, count(spb) as authorPullCount, sum(recency) as authorPullRecencyScore, a.email as email`,
     
        { key , startDate, todayDate}
        )
    );


    res.records.forEach((r)=> {
        var name =  r._fields[0];
        var reviewCount = r._fields[1].low;
        var reviewRecencyScore = r._fields[2];

        // console.log('====================================');
        // console.log(`${name } has pull count ${pullCount} and pr recency ${pullRecencyScore}`);           

        const alreadyExists = expertsAndScores.some(item => item.authorName === name);

        if ( alreadyExists) {

            // console.log(`${name } already existed in the expertsAndScores`);           
            const targetIndex = expertsAndScores.findIndex(item => item.authorName === name);
            expertsAndScores[targetIndex].reviewCount = reviewCount;
            expertsAndScores[targetIndex].reviewRecencyScore = reviewRecencyScore;
        } else {
            expertsAndScores.push({
                "authorName": r._fields[0],
                "email": r._fields[3],
                "commitCount": 0,
                "commitRecencyScore":0,
                "prCount": 0,
                "prRecencyScore" : 0,
                "reviewCount": reviewCount,
                "reviewRecencyScore": reviewRecencyScore,
                
            })
        }
       
       
    });

}

export {get_method_review_author_recency}