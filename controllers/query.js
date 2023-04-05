import neo4j, { Node, Relationship, Integer, auth } from 'neo4j-driver';
export const getRecommendations = async (req, res) => {
    var { source, path, repoId} = req.body;

    if(path[0] == "/") {
        path = path.substring(1);
    }

    try {

        // connect to neo4j
        const uri= process.env.NEO_URI;
        const user= process.env.NEO_USER;
        const password = process.env.NEW_PWD;
        const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
        const session = driver.session();

        // TODO : const maxExpertNo = parseInt("3");
        let experts =[];
        if (source == "file") {
            const res = await session.readTransaction(txc =>
                txc.run(
                `
                    MATCH (f:File{path: $path}) WITH f 
                    MATCH(f)<-[mf:ADDED_FILE]-(c:Commit)-[cb:COMMITED_BY]->(a:Author)  
                    return count(cb) as commit_count, a.authorName as commited_by 
                    ORDER BY count(cb) DESC limit 3
                `,
                { path }
                )
            );

            res.records.forEach((r)=> {
                const name = r._fields[1];
                experts.push(name);
            });

        } else { // source is folder

        }

        console.log(experts);

        return res.status(200).json(experts);
        
    } catch (error) {
        return res.status(404).json([]);
    }
    


}
