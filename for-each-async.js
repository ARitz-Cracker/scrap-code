// Long ago before the time of promises and Promise.all, ForEachAsync was born
exports.ForEachAsync = function(tab,func,done){
	var total = 0;
	var progess = 0;
	var called = false;
	for (var k in tab) {
		total += 1;
	}
	if (total === 0){
		process.nextTick(done,null);
	}else{
		try{
			for (var k in tab) {
				process.nextTick(func,k,tab[k],function(err){
					if (err){
						done(err);
						called = true;
					}else if (!called){
						progess+=1
						if (progess==total){
							process.nextTick(done,null);
						}
					}
				});
			}	
		}catch(ex){
			process.nextTick(done,ex);
			called = true;
		}
	}
}
