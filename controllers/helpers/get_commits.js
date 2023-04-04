import fs from 'fs';
import {spawn} from 'child_process';

function get_commits(repo_owner, repo_name, path_commits, path_log) {
    return new Promise((resolve, reject) => {
      
        var process = spawn('python3',["./controllers/perceval_git.py", repo_owner, repo_name, path_commits, path_log] );        
        fs.writeFileSync(path_commits, "")

        process.stdout.on('data', function(data) {
            var dataStr =  data.toString()
            fs.appendFileSync(path_commits,  dataStr )
        } )    

        process.stderr.on('data', (data) => {
            console.error(`stderr: ${data}`);
            fs.appendFileSync(path_log, data.toString())
        });
        
        process.stdout.on('close', (code) => {
            console.log("COMMITS: finished");
            fs.appendFileSync(path_log, "\nCOMMITS: Finished fetching")
            resolve(code);
        } ) 
    });
}

export { get_commits };
