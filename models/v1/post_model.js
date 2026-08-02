const db = require("../../config/db")
const common = require("../../utils/common")
const { sendResponse } = require("../../utils/middleware")
const dotenv = require("dotenv")

dotenv.config()

const homePage = async (req, res) => {
    try {
        if (!req.loginUser || Object.keys(req.loginUser).length === 0) {
            return sendResponse(req, res, 400, 0, "Error At Fetching Login User Data");
        }

        let user = await common.getUser(req.loginUser.data.user_id);

        const { post = "new", type = null, category = null, pageTrending = 1, limitTrending = 10, pagePost = 1, limitPost = 10, pageCategory = 1, limitCategory = 10 } = req.query;


        const baseSelect = `
        SELECT 
            p.id AS post_id,p.post_user_id AS user_id,u.username,u.profile_photo_path,p.post_type,p.ranking_expired_on, p.cat_id,c.name,( SELECT JSON_ARRAYAGG( JSON_OBJECT( 'm_id', m2.id, 'type', m2.media_type,'url', m2.media_url )) FROM tbl_post_media m2 WHERE m2.post_id = p.id AND m2.is_active = 1 AND m2.is_delete = 0 ) AS media,
            COUNT(DISTINCT r.id) AS ranking_total,
            COUNT(DISTINCT rate.id) AS rating_total,
            SUM(rate.rating) / NULLIF(COUNT(DISTINCT rate.id), 0) AS rating_avg
        FROM tbl_post p 
        JOIN tbl_post_media m ON m.post_id = p.id AND m.is_active = 1 AND m.is_delete = 0
        JOIN tbl_user u ON u.id = p.post_user_id AND u.is_active = 1 AND u.is_delete = 0
        JOIN tbl_category c ON c.id = p.cat_id AND c.is_active = 1 AND c.is_delete = 0
        LEFT JOIN tbl_ranking r ON r.post_media_id = m.id AND r.is_active = 1 AND r.is_delete = 0
        LEFT JOIN tbl_rating rate ON rate.post_id = p.id AND rate.is_active = 1 AND rate.is_delete = 0
        WHERE p.is_active = 1 AND p.is_delete = 0
        `;

        const trendingQuery = `${baseSelect} GROUP BY p.id ORDER BY rating_avg DESC, rating_total DESC, ranking_total DESC`;

        let trendingLimitStr = ` LIMIT ${limitTrending} OFFSET ${(pageTrending - 1) * limitTrending}`;

        let postCondition = "";
        // console.log(post)
        if (post === "new") {
            postCondition = ` AND p.post_user_id NOT IN (SELECT f.other_user_id FROM tbl_follow f WHERE f.sender_id = ${user.id})`;
        } else if (post === "following") {
            postCondition = ` AND p.post_user_id IN (SELECT f.other_user_id FROM tbl_follow f WHERE f.sender_id = ${user.id})`;
        } else if (post === "expiring") {
            postCondition = ` AND p.ranking_expired_on >= NOW()`;
        } else {
            return sendResponse(req, res, 400, 0, "Invalid Request For Post", {});
        }

        if (type != null && post!="expiring") {
            if (["M", "V", "C"].includes(type) == true) {
                postCondition += ` AND p.post_type = '${type}' `
            } else {
                return sendResponse(req, res, 400, 0, "Invalid Request For Post Type Either M,V or C", {});
            }
        }

        const postQuery = baseSelect + postCondition + ` GROUP BY p.id  ORDER BY p.created_at DESC`;
        
        let postLimitStr = ` LIMIT ${limitPost} OFFSET ${(pagePost - 1) * limitPost}`;


        let categoryCondition = "";
        if (category) {
            categoryCondition = ` AND c.id IN (${category})`;
        }

        const categoryQuery = baseSelect + categoryCondition + ` GROUP BY p.id ORDER BY p.created_at DESC`;
        let categoryLimitStr = ` LIMIT ${limitCategory} OFFSET ${(pageCategory - 1) * limitCategory}`;

        const trendingSqlQuery = trendingQuery + trendingLimitStr;
        const postSqlQuery = postQuery + postLimitStr;
        const categoryListQuery = `SELECT id,name FROM tbl_category WHERE is_active=1 AND is_delete=0`;
        const categoryPostListQuery = categoryQuery + categoryLimitStr;

        const trendingResult = await db.query(trendingSqlQuery);
        const postResult = await db.query(postSqlQuery);
        
        const categoryResult = await db.query(categoryListQuery);
        const categoryPostResult = await db.query(categoryPostListQuery);

        return sendResponse(req, res, 200, 1, "Homepage Posts Fetch Successfully", {
            trendingPost: trendingResult[0],
                postData: postResult[0],
                categoryData: categoryResult[0],
            categoryPostData: categoryPostResult[0]
        });

    } catch (err) {
        console.log(err);
        return sendResponse(req, res, 500, 0, "Error During Homepage Post", {});
    }
};

const categoryList = async (req, res) => {
    try {


        const categoryResult = await db.query("SELECT id,name FROM tbl_category where is_active=1 and is_delete=0")
        if (categoryResult && categoryResult[0] && Object.keys(categoryResult[0]).length > 0) {
            return sendResponse(req, res, 200, 1, "Category Data Fetch Successfully", {
                "categoryData": categoryResult[0]
            })
        } else {
            return sendResponse(req, res, 200, 3, "No Category Data Found", {})
        }

    } catch (err) {
        console.log(err)
        return sendResponse(req, res, 500, 0, "Error During Fetching Category Listing", {})
    }
}

const categoryPostList = async (req, res) => {
    try {
        if (!req.query.id) {
            return sendResponse(req, res, 400, 0, "Pass Id In Query String", {})
        }
        const { id = null, page = 1, limit = 10 } = req.query;

        const query = `SELECT 
                        p.id AS post_id,p.post_user_id AS user_id,u.username,u.profile_photo_path,p.post_type,p.ranking_expired_on, p.cat_id,c.name,( SELECT JSON_ARRAYAGG( JSON_OBJECT( 'm_id', m2.id, 'type', m2.media_type,'url', m2.media_url )) FROM tbl_post_media m2 WHERE m2.post_id = p.id AND m2.is_active = 1 AND m2.is_delete = 0 ) AS media,
                        COUNT(DISTINCT r.id) AS ranking_total,
                        COUNT(DISTINCT rate.id) AS rating_total,
                        SUM(rate.rating) / NULLIF(COUNT(DISTINCT rate.id), 0) AS rating_avg
                    FROM tbl_post p 
                    JOIN tbl_post_media m ON m.post_id = p.id AND m.is_active = 1 AND m.is_delete = 0
                    JOIN tbl_user u ON u.id = p.post_user_id AND u.is_active = 1 AND u.is_delete = 0
                    JOIN tbl_category c ON c.id = p.cat_id AND c.is_active = 1 AND c.is_delete = 0
                    LEFT JOIN tbl_ranking r ON r.post_media_id = m.id AND r.is_active = 1 AND r.is_delete = 0
                    LEFT JOIN tbl_rating rate ON rate.post_id = p.id AND rate.is_active = 1 AND rate.is_delete = 0
                    WHERE p.is_active = 1 AND p.is_delete = 0 AND c.id IN (?) GROUP BY p.id ORDER BY p.created_at DESC  LIMIT ${limit} OFFSET ?`
        const categoryPostResult = await db.query(query, [id, (page - 1) * limit])

        if (categoryPostResult && categoryPostResult[0] && Object.keys(categoryPostResult[0]).length > 0) {
            return sendResponse(req, res, 200, 1, "Category Post Data Fetch Successfully", {
                "categoryData": categoryPostResult[0]
            })
        } else {
            return sendResponse(req, res, 200, 3, "No Category Data Found", {})
        }
    }
    catch (err) {
        console.log(err)
        return sendResponse(req, res, 500, 0, "Error During Category Post List", {})
    }
}

const postDetails = async (req, res) => {
    try {
        if (!req.params.id) {
            return sendResponse(req, res, 400, 0, "Pass Id In Parameters", {})
        }

        if (!req.loginUser?.data?.user_id) {
            return sendResponse(req, res, 400, 0, "User Data Not Found", {})
        }


        const userId = req.loginUser?.data?.user_id
        const id = req.params.id

        const query = `SELECT 
                        p.id AS post_id,p.post_user_id AS user_id,u.username,u.profile_photo_path,p.post_type,p.ranking_expired_on, p.cat_id,c.name,( SELECT JSON_ARRAYAGG( JSON_OBJECT( 'm_id', m2.id, 'type', m2.media_type,'url', m2.media_url )) FROM tbl_post_media m2 WHERE m2.post_id = p.id AND m2.is_active = 1 AND m2.is_delete = 0 ) AS media,
                        COUNT(DISTINCT r.id) AS ranking_total,
                        COUNT(DISTINCT rate.id) AS rating_total,
                        SUM(rate.rating) / NULLIF(COUNT(DISTINCT rate.id), 0) AS rating_avg,
                        COUNT(DISTINCT comment.id) AS comment_total,
                        COUNT(DISTINCT save_post.id) AS is_saved,
                        CASE 
                            WHEN p.ranking_expired_on < NOW() THEN 
                            (
                                SELECT JSON_ARRAYAGG(JSON_OBJECT('m_id', ranked.m_id,'rank', ranked.final_rank))
                                FROM (
                                    SELECT m.id AS m_id,
                                        ROW_NUMBER() OVER (
                                            ORDER BY 
                                                SUM(CASE WHEN r.rank_order = 1 THEN 1 ELSE 0 END) DESC,
                                                SUM(CASE WHEN r.rank_order = 2 THEN 1 ELSE 0 END) DESC,
                                                SUM(CASE WHEN r.rank_order = 3 THEN 1 ELSE 0 END) DESC
                                        ) AS final_rank

                                    FROM tbl_post_media m LEFT JOIN tbl_ranking r ON r.post_media_id = m.id AND r.is_active = 1 AND r.is_delete = 0
                                    WHERE m.post_id = p.id GROUP BY m.id) AS ranked)
                            ELSE NULL
                        END AS ranking
                    FROM tbl_post p 
                    JOIN tbl_post_media m ON m.post_id = p.id AND m.is_active = 1 AND m.is_delete = 0
                    JOIN tbl_user u ON u.id = p.post_user_id AND u.is_active = 1 AND u.is_delete = 0
                    JOIN tbl_category c ON c.id = p.cat_id AND c.is_active = 1 AND c.is_delete = 0
                    LEFT JOIN tbl_ranking r ON r.post_media_id = m.id AND r.is_active = 1 AND r.is_delete = 0
                    LEFT JOIN tbl_rating rate ON rate.post_id = p.id AND rate.is_active = 1 AND rate.is_delete = 0
                    LEFT JOIN tbl_comment comment on comment.post_id=p.id AND comment.is_active=1 and comment.is_delete=0
                    LEFT JOIN tbl_saved_post save_post ON save_post.user_id=? and save_post.post_id=? and save_post.is_active=1 and save_post.is_delete=0
                    WHERE p.is_active = 1 AND p.is_delete = 0 AND p.id=? GROUP BY p.id`
        const postResult = await db.query(query, [userId, id, id])

        if (postResult && postResult[0] && Object.keys(postResult[0]).length > 0) {
            return sendResponse(req, res, 200, 1, "Post Data Fetch Successfully", {
                "postData": postResult[0]
            })
        } else {
            return sendResponse(req, res, 200, 3, "No Post Data Found", {})
        }
    } catch (err) {
        console.log(err)
        return sendResponse(req, res, 500, 0, "Error During Fetching Post Details", {})
    }
}

const addRanking = async (req, res) => {

    try {
        if (!req.loginUser?.data?.user_id) {
            return sendResponse(req, res, 400, 3, "User Data Not Found", {})
        }


        const userId = req.loginUser?.data?.user_id
        const { post_id: postId, ranking } = req.body

        if (!postId || !Array.isArray(ranking) || ranking.length === 0) {
            return sendResponse(req, res, 400, 0, "Invalid request data", {})
        }

        const post = await common.getPost(postId)
        if (!post) {
            return sendResponse(req, res, 200, 3, "Post not found", {})
        }

        if (post.post_type != "C") {
            return sendResponse(req, res, 400, 0, "Post Type Is Not Compare", {})
        }

        // Expiry check
        if (new Date(post.ranking_expired_on) < new Date()) {
            return sendResponse(req, res, 400, 0, "Ranking expired for this post", {})
        }

        const postMediaIds = post.media.map(m => m.m_id)

        // Enforce full ranking
        if (ranking.length !== postMediaIds.length) {
            return sendResponse(req, res, 400, 0, "You must rank all media of this post", {})
        }

        // Check If Already Ranked
        const [existing] = await db.query(
            `SELECT id FROM tbl_ranking WHERE user_id = ? AND post_media_id IN (?) LIMIT 1`,
            [userId, postMediaIds]
        )

        if (existing.length > 0) {
            return sendResponse(req, res, 200, 0, "You Already Ranked This Post", {})
        }

        let invalidIds = []
        let seenMedia = new Set()
        let seenRanks = new Set()

        // Validate ranking items
        for (let item of ranking) {
            const m_id = Number(item.m_id)
            const rank = Number(item.rank)

            if (!m_id || !rank) {
                return sendResponse(req, res, 400, 0, "m_id and rank are required", {})
            }

            if (!Number.isInteger(rank) || rank <= 0) {
                return sendResponse(req, res, 400, 0, "Rank must be a positive integer", {})
            }

            // invalid media
            if (!postMediaIds.includes(m_id)) {
                invalidIds.push(m_id)
            }

            // duplicate media
            if (seenMedia.has(m_id)) {
                return sendResponse(req, res, 400, 0, "Duplicate media_id found", {})
            }
            seenMedia.add(m_id)

            // duplicate rank
            if (seenRanks.has(rank)) {
                return sendResponse(req, res, 400, 0, "Duplicate rank found", {})
            }
            seenRanks.add(rank)
        }


        if (invalidIds.length > 0) {
            return sendResponse(req, res, 400, 0, "Invalid media IDs", { invalidIds })
        }

        // Rank must be sequential (1 → N)
        const sortedRanks = [...seenRanks].sort((a, b) => a - b)
        for (let i = 0; i < sortedRanks.length; i++) {
            if (sortedRanks[i] !== i + 1) {
                return sendResponse(req, res, 400, 0, "Ranks must be sequential starting from 1", {})
            }
        }

        // Add Ranking
        const values = ranking.map(r => [
            userId,
            Number(r.m_id),
            Number(r.rank)
        ])
        const [insertRank] = await db.query(
            `INSERT INTO tbl_ranking (user_id, post_media_id, rank_order) VALUES ?`,
            [values]
        )

        if (insertRank.affectedRows > 0) {
            return sendResponse(req, res, 200, 1, "Ranking Added Successfull", {})
        }
        return sendResponse(req, res, 200, 0, "Error During Inserting Rank", {})
    } catch (err) {
        console.log(err)
        return sendResponse(req, res, 500, 0, "Error During Post Ranking", {})
    }
}

const addRating = async (req, res) => {
    try {
        if (!req.loginUser?.data?.user_id) {
            return sendResponse(req, res, 400, 0, "User Data Not Found", {})
        }

        const userId = req.loginUser?.data?.user_id
        const { post_id: postId, rating } = req.body

        const post = await common.getPost(postId)

        if (!post) {
            return sendResponse(req, res, 200, 3, "Post not found", {})
        }

        if (post.post_type == "C") {
            return sendResponse(req, res, 400, 0, "Post Type Is Compare Which Does Not Contain Rating", {})
        }

        const [existing] = await db.query(
            `SELECT id FROM tbl_rating WHERE user_id = ? AND post_id IN (?) LIMIT 1`,
            [userId, postId]
        )

        if (existing.length > 0) {
            return sendResponse(req, res, 200, 0, "You Already Ranked This Post", {})
        }

        const [insertRating] = await db.query("INSERT INTO tbl_rating(user_id,post_id,rating) values(?,?,?)", [userId, postId, rating])
        if (insertRating.affectedRows > 0) {
            return sendResponse(req, res, 200, 1, "Rating Added Successfully", {})
        }
        return sendResponse(req, res, 200, 0, "Error During Inserting Rating", {})

    } catch (err) {
        console.log(err)
        return sendResponse(req, res, 500, 0, "Error During Post Ranking", {})
    }
}

const addComment = async (req, res) => {
    try {

        if (!req.loginUser?.data?.user_id) {
            return sendResponse(req, res, 400, 0, "User Data Not Found", {})
        }

        const userId = req.loginUser?.data?.user_id
        const { post_id, comment_text } = req.body

        const post = await common.getPost(post_id)
        if (!post) {
            return sendResponse(req, res, 200, 3, "Post not found", {})
        }

        const [addComment] = await db.query("INSERT INTO tbl_comment(user_id,post_id,comment_text) values(?,?,?)", [userId, post_id, comment_text])
        if (addComment && addComment.affectedRows > 0) {
            return sendResponse(req, res, 200, 1, "Post Comment Successfully", {})
        }
        return sendResponse(req, res, 200, 0, "Error While Inserting Comment", {})
    } catch (err) {
        console.log(err)
        return sendResponse(req, res, 500, 0, "Error During Adding Post Comment", {})
    }
}

const saveUnsavePost = async (req, res) => {
    try {
        if (!req.loginUser?.data?.user_id) {
            return sendResponse(req, res, 400, 0, "User Data Not Found", {})
        }

        const userId = req.loginUser?.data?.user_id
        const { post_id } = req.body

        const post = await common.getPost(post_id)
        if (!post) {
            return sendResponse(req, res, 200, 3, "Post not found", {})
        }

        const [isSaveExist] = await db.query("SELECT id from tbl_saved_post where user_id=? and post_id=? and is_active=1 and is_delete=0", [userId, post_id])

        if (isSaveExist && isSaveExist.length > 0) {
            const [deleteSave] = await db.query("UPDATE tbl_saved_post SET is_active=0,is_delete=1 WHERE user_id=? and post_id=?", [userId, post_id])
            if (deleteSave && deleteSave.affectedRows > 0) {
                return sendResponse(req, res, 200, 1, "Saved Post Deleted Successfully", {})
            }
            return sendResponse(req, res, 200, 0, "Error During Deleting Saved Post", {})
        }

        const [addSave] = await db.query("INSERT INTO tbl_saved_post(user_id,post_id) values (?,?)", [userId, post_id])
        if (addSave && addSave.affectedRows > 0) {
            return sendResponse(req, res, 200, 1, "Post Saved Successfully", {})
        }
        return sendResponse(req, res, 200, 0, "Error During Adding New Saved Post", {})
    } catch (err) {
        console.log(err)
        return sendResponse(req, res, 500, 0, "Error During Saving Post", {})
    }
}

const reportPost = async (req, res) => {
    try {

        if (!req.loginUser?.data?.user_id) {
            return sendResponse(req, res, 400, 0, "User Data Not Found", {})
        }

        const userId = req.loginUser?.data?.user_id
        const { post_id, report_text } = req.body

        const post = await common.getPost(post_id)
        if (!post) {
            return sendResponse(req, res, 200, 3, "Post not found", {})
        }

        const [isReportExist] = await db.query("SELECT id,reason from tbl_post_report where user_id=? and post_id=? and is_active=1 and is_delete=0", [userId, post_id])

        if (isReportExist && isReportExist.length > 0) {
            if (isReportExist[0].reason == report_text.trim()) {
                return sendResponse(req, res, 200, 0, "Post Already Reported With The Same Reason", {})
            }
        }

        const [addReport] = await db.query("INSERT INTO tbl_post_report(user_id,post_id,reason) values(?,?,?)", [userId, post_id, report_text])
        if (addReport && addReport.affectedRows > 0 && addReport.insertId > 0) {
            return sendResponse(req, res, 200, 1, "Post Reported Successfully", {})
        }
        return sendResponse(req, res, 200, 0, "Error While Adding New Report", {})
    } catch (err) {
        console.log(err)
        return sendResponse(req, res, 500, 0, "Error During Reporting Post", {})
    }
}

const createPost = async (req, res) => {
    try {
        if (!req.loginUser?.data?.user_id) {
            return sendResponse(req, res, 400, 0, "User Data Not Found", {})
        }

        const userId = req.loginUser?.data?.user_id
        const { description, cat_id, post_type, ranking_expired_on, media } = req.body

        const postObj = {
            post_user_id: userId,
            description,
            cat_id,
            post_type,
            ranking_expired_on
        }

        const [addPost] = await db.query(`INSERT INTO tbl_post (post_user_id, description, cat_id, post_type, ranking_expired_on) VALUES (?)`, [Object.values(postObj)])
        if (addPost && addPost.affectedRows > 0) {
            const mediaObj = media.map(m => [
                addPost.insertId,
                m.media_type,
                m.media_url
            ])

            const [addPostMedia] = await db.query(`INSERT INTO tbl_post_media (post_id,media_type,media_url) VALUES ?`, [mediaObj])
            const post = await common.getPost(addPost.insertId)
            if (addPostMedia.affectedRows > 0) {
                return sendResponse(req, res, 200, 1, "Post Created Successfully", {
                    "postData": post
                })
            }
            return sendResponse(req, res, 200, 0, "Error While Creating Post", {})
        }
    } catch (err) {
        console.log(err)
        return sendResponse(req, res, 500, 0, "Error During Creating Post", {})
    }
}

const deletePost = async (req, res) => {
    try {
        if (!req.loginUser?.data?.user_id) {
            return sendResponse(req, res, 400, 0, "User Data Not Found", {})
        }

        const userId = req.loginUser?.data?.user_id
        const postId = req.body.post_id

        const [existingPost] = await db.query("SELECT id FROM tbl_post where post_user_id=? and id=? and is_active=1 and is_delete=0", [userId, postId])
        if (existingPost && existingPost[0] && existingPost.length > 0) {
            const [deletePost] = await db.query("UPDATE tbl_post SET is_active=0,is_delete=1 WHERE id=?", [postId])

            await db.query(
                `UPDATE tbl_post_media SET is_active=0, is_delete=1 WHERE post_id=?`,
                [postId]
            )
            if (deletePost.affectedRows > 0) {
                return sendResponse(req, res, 200, 1, "Post Deleted Successfully", {})
            }
            return sendResponse(req, res, 200, 0, "Error While Deleting Post", {})
        }
        return sendResponse(req, res, 200, 0, "Post Not Found Or Not Belongs To You")
    } catch (err) {
        console.log(err)
        return sendResponse(req, res, 500, 0, "Error During Deleting Post", {})
    }
}



module.exports = { homePage, categoryList, categoryPostList, postDetails, addRanking, addRating, createPost, deletePost, saveUnsavePost, reportPost, addComment }