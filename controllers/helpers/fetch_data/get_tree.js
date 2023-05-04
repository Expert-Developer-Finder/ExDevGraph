import fs from 'fs';
import axios from  'axios';

async function get_tree(repo_owner, repo_name, branch, path_tree, log_path, tokens) {
    console.log(repo_owner);
    console.log(repo_name);
    try {
        const config = {
            headers: { Authorization: `Bearer ${tokens[0]}` },
        };
        var {data} = await axios.get(
            `https://api.github.com/repos/${repo_owner}/${repo_name}/git/trees/${branch}?recursive=1`
        );
        
        fs.writeFileSync(path_tree, JSON.stringify(data));

        console.log(
            `TREE: Fethced tree of files and folder of ${repo_owner}/${repo_name} and extracted them to ${path_tree}`
        );
        fs.appendFileSync(log_path, 
            `\nTREE: Fethced tree of files and folder of ${repo_owner}/${repo_name} and extracted them to ${path_tree}`
        );
    } catch (error) {
        // if the data is empty, then we have fetched everything
        console.log(
            `TREE: Error occured while fetching the tree of ${repo_owner}/${repo_name}: ${error.message}`
        );
        fs.appendFileSync(log_path, 
            `\nTREE: Error occured while fetching the tree of ${repo_owner}/${repo_name}: ${error.message}`
        );
    }
   
}

export {get_tree};