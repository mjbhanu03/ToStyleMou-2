const md5 = require("md5")
const common = require("../../utils/common")
const { sendResponse } = require("../../utils/middleware")
const db = require("../../config/db")

const getUserProfile = async (req, res) => {
    try {
        if (Object.keys(req.loginUser) == 0) {
            return sendResponse(req, res, 400, 0, "Error At Fetching Login User Data")
        }
        
        let visitorUser = null
        if (!req.query.user_id) {
             visitorUser = req.loginUser.data.user_id
        }

        
        if (req.query.user_id && req.query.user_id != req.loginUser.data.user_id) {
            visitorUser = req.query.user_id
        }
        let userResult = null
        let postResult = null


        let userSqlQuery = ``

        if (visitorUser == null) {
            userSqlQuery = `
                SELECT u.id,u.full_name,u.username,u.profile_photo_path,
                (SELECT count(*) FROM tbl_follow WHERE other_user_id=u.id) as follower_count,
                (SELECT count(*) FROM tbl_follow WHERE sender_id=u.id) as following_count,
                COUNT(DISTINCT rate.id) as rating_count
                FROM tbl_user as u
                LEFT JOIN tbl_rating rate ON rate.user_id=${req.query.user_id} and rate.is_active=1 and rate.is_delete=0
                WHERE u.id=${req.query.user_id} and u.is_active=1 and u.is_delete=0
            `
        } else {
            userSqlQuery = `
                SELECT u.id,u.full_name,u.username,u.profile_photo_path,
                (SELECT count(*) FROM tbl_follow WHERE other_user_id=u.id) as follower_count,
                (SELECT count(*) FROM tbl_follow WHERE sender_id=u.id) as following_count,
                COUNT(DISTINCT rate.id) as rating_count,
                (CASE
                    WHEN follow.id is null THEN 0 ELSE 1
                END)is_followed, 
                (SELECT count(*) FROM tbl_follow WHERE other_user_id=u.id) as follower_count,
                (SELECT count(*) FROM tbl_follow WHERE sender_id=u.id) as following_count
                FROM tbl_user as u
                LEFT JOIN tbl_rating rate ON rate.user_id=${visitorUser} and rate.is_active=1 and rate.is_delete=0
                LEFT JOIN tbl_follow as follow ON follow.sender_id=${req.loginUser.data.user_id} and follow.other_user_id=u.id
                WHERE u.id=${visitorUser} and u.is_active=1 and u.is_delete=0
            `
        }

        let postSqlQuery = ``
        if (visitorUser == null) {
            postSqlQuery = `
            SELECT post.id,post.post_type,post.created_at,
            ( SELECT JSON_ARRAYAGG( JSON_OBJECT( 'm_id', m2.id, 'type', m2.media_type,'url', m2.media_url )) FROM tbl_post_media m2 WHERE m2.post_id = post.id AND m2.is_active = 1 AND m2.is_delete = 0 ) AS media
            FROM tbl_post as post
            WHERE post.post_user_id=${req.loginUser.data.user_id} and post.is_active=1 and post.is_delete=0 ORDER BY post.created_at
        `
        }
        else {
            postSqlQuery = `
            SELECT post.id,post.post_type,post.created_at,
            ( SELECT JSON_ARRAYAGG( JSON_OBJECT( 'm_id', m2.id, 'type', m2.media_type,'url', m2.media_url )) FROM tbl_post_media m2 WHERE m2.post_id = post.id AND m2.is_active = 1 AND m2.is_delete = 0 ) AS media
            FROM tbl_post as post
            WHERE post.post_user_id=${visitorUser} and post.is_active=1 and post.is_delete=0 ORDER BY post.created_at
        `
        }

        userResult = await db.query(userSqlQuery)
        if (userResult && userResult[0] && Object.values(userResult).length > 0) {
            userResult = userResult[0]
        }

        postResult = await db.query(postSqlQuery)
        // console.log(postResult)
        if (postResult && postResult[0] && Object.values(postResult).length > 0) {
            postResult = postResult[0]
        }

        if (userResult && userResult.length > 0) {
            return sendResponse(req, res, 200, 1, "User Profile Fetch Successfull", {
                "userData": userResult,
                "postData": postResult
            })
        }
        return sendResponse(req, res, 200, 0, "Error Fetching User Profile", {})
    } catch (err) {
        console.log(err);
        return sendResponse(req, res, 500, 0, "Error At Fetching Your Profile", {})
    }
}

const toggleFollow = async (req, res) => {
    try {

        if (Object.keys(req.loginUser) == 0) {
            return sendResponse(req, res, 400, 0, "Error At Fetching Login User Data")
        }
        // console.log(req.loginUser)
        let senderUser = await common.getUser(req.loginUser.data.user_id)
        let receiverUser = await common.getUser(req.body.other_user_id)

        if (receiverUser == null) {
            return sendResponse(req, res, 200, 3, "User Not Found", {})
        }

        const followExist = await db.query("SELECT id from tbl_follow where sender_id=? and other_user_id=?", [senderUser.id, receiverUser.id])
        if (followExist && followExist[0] && Object.keys(followExist[0]).length > 0) {
            const deleteFollow = await db.query("DELETE FROM tbl_follow WHERE sender_id=? and other_user_id=?", [senderUser.id, receiverUser.id])
            if (deleteFollow[0].affectedRows > 0) {
                return sendResponse(req, res, 200, 1, "User Unfollowed Succesfully", {})
            }
            return sendResponse(req, res, 500, 0, "Error While Unfollowing", {})
        }

        const addNewFollow = await db.query("INSERT INTO tbl_follow(sender_id,other_user_id) values(?,?)", [senderUser.id, receiverUser.id])
        if (addNewFollow[0].affectedRows > 0) {
            return sendResponse(req, res, 200, 1, "User followed Succesfully", {})
        }
        return sendResponse(req, res, 200, 1, "Error While Following", {})


    } catch (err) {
        console.log(err);
        return sendResponse(req, res, 500, 0, "Error At Following User", {})
    }
}

const updateProfile = async (req, res) => {
    try {

        if (Object.keys(req.loginUser) == 0) {
            return sendResponse(req, res, 400, 0, "Error At Fetching Login User Data")
        }
        // console.log(req.loginUser)
        let user = await common.getUser(req.loginUser.data.user_id)
        const user_id = user.id

        let user_update_obj = {}

        // console.log(req.body)
        if (req.body.full_name) {
            user_update_obj.full_name = req.body.full_name
        }

        if (req.body.email) {
            user_update_obj.email = req.body.email
        }

        if (req.body.username) {
            user_update_obj.username = req.body.username
        }

        if (req.body.country_code && req.body.phone) {
            user_update_obj.country_code = req.body.country_code
            user_update_obj.phone = req.body.phone
        }

        if (req.body.dob) {
            user_update_obj.dob = req.body.dob
        }

        if (req.body.profile_photo) {
            user_update_obj.profile_photo_path = req.body.profile_photo
        }

        // console.log(user_update_obj)
        if (user_update_obj && Object.keys(user_update_obj).length === 0) {
            return sendResponse(req, res, 400, "2", "No Fields To Update", {})
        }

        const updateResult = await db.query("UPDATE tbl_user SET ? where id=?", [user_update_obj, user_id])
        const userData = await common.getUser(user_id)
        if (updateResult[0].affectedRows > 0) {
            return sendResponse(req, res, 200, "0", "User Profile Updated Successfully", { "userData": userData })
        } else {
            return sendResponse(req, res, 500, "0", "Error During Updating User Profile", { "userData": userData })
        }

    } catch (err) {
        console.log(err)
        return sendResponse(req, res, 500, "0", "Error During Updating User Profile", {})
    }
}

const userSavePostList = async (req, res) => {
    try {
        if (Object.keys(req.loginUser) == 0) {
            return sendResponse(req, res, 400, 0, "Error At Fetching Login User Data")
        }
        // console.log(req.loginUser)

        if (!req.loginUser.data || !req.loginUser.data.user_id) {
            return sendResponse(req, res, 200, 0, "NO Loggeed In User Data Found", {})
        }
        let userId = req.loginUser.data.user_id

        let page = 1
        let size = 5

        if (req.body && req.body.page && req.body.size && req.body.page > 0 && req.body.size > 0) {
            page = req.body.page
            size = req.body.size
        }

        offset = (page - 1) * size

        let query = `SELECT 
                        save_post.id, p.id AS post_id,p.post_user_id AS user_id,u.username,u.profile_photo_path,p.post_type,p.ranking_expired_on, p.cat_id,c.name,( SELECT JSON_ARRAYAGG( JSON_OBJECT( 'm_id', m2.id, 'type', m2.media_type,'url', m2.media_url )) FROM tbl_post_media m2 WHERE m2.post_id = p.id AND m2.is_active = 1 AND m2.is_delete = 0 ) AS media,
                        COUNT(DISTINCT r.id) AS ranking_total,
                        COUNT(DISTINCT rate.id) AS rating_total,
                        SUM(rate.rating) / NULLIF(COUNT(DISTINCT rate.id), 0) AS rating_avg,
                        COUNT(DISTINCT comments.id) AS comment_total
                    FROM tbl_post p 
                    JOIN tbl_post_media m ON m.post_id = p.id AND m.is_active = 1 AND m.is_delete = 0
                    JOIN tbl_user u ON u.id = p.post_user_id AND u.is_active = 1 AND u.is_delete = 0
                    JOIN tbl_category c ON c.id = p.cat_id AND c.is_active = 1 AND c.is_delete = 0
                    LEFT JOIN tbl_ranking r ON r.post_media_id = m.id AND r.is_active = 1 AND r.is_delete = 0
                    LEFT JOIN tbl_rating rate ON rate.post_id = p.id AND rate.is_active = 1 AND rate.is_delete = 0
                    LEFT JOIN tbl_comment comments on comments.post_id=p.id AND comments.is_active=1 and comments.is_delete=0
                    JOIN tbl_saved_post save_post ON save_post.user_id=${userId} and save_post.post_id=p.id and save_post.is_active=1 and save_post.is_delete=0
                    WHERE p.is_active = 1 AND p.is_delete = 0 GROUP BY save_post.id,p.id`

        let limit = ` LIMIT ${size} offset ${offset} `

        let sqlQuery = query + limit

        // console.log(sqlQuery)

        const savedPosts = await db.query(sqlQuery)

        if (savedPosts && savedPosts[0] && Object.keys(savedPosts[0]).length > 0) {
            return sendResponse(req, res, 200, 1, "Saved Post Data Fetch Successfull", {
                "savedPostData": savedPosts[0]
            })
        }

        return sendResponse(req, res, 200, 3, "No Saved Post Data Found", {})
    } catch (err) {
        console.log(err)
        return sendResponse(req, res, 500, 0, "Error During Fetching Save Post List", {})
    }
}

const followerList = async (req, res) => {
    try {

        if (Object.keys(req.loginUser) == 0) {
            return sendResponse(req, res, 400, 0, "Error At Fetching Login User Data")
        }
        // console.log(req.loginUser)
        let user = await common.getUser(req.loginUser.data.user_id)

        let visitorUser = await common.getUser(req.body.user_id)

        if (visitorUser == null) {
            return sendResponse(req, res, 200, 3, "User Not Found", {})
        }

        if (visitorUser == null) {
            return sendResponse(req, res, 200, 3, "User Not Found", {})
        }

        let sqlQuery = ``

        if (user.id == visitorUser.id) {
            sqlQuery = `SELECT follower.id,u.id,u.profile_photo_path,u.username
                            FROM tbl_follow as follower
                            JOIN tbl_user as u ON u.id=follower.sender_id and u.is_active=1 and u.is_delete=0
                            WHERE follower.other_user_id=${visitorUser.id}`
        } else {
            sqlQuery = `SELECT follower.id,u.id,u.profile_photo_path,u.username,
                            (CASE 
                                WHEN following.id is null THEN 0 ELSE 1
                            END) as is_following
                            FROM tbl_follow as follower
                            JOIN tbl_user as u ON u.id=follower.sender_id and u.is_active=1 and u.is_delete=0
                            LEFT JOIN tbl_follow as following ON following.sender_id=follower.other_user_id and following.other_user_id=follower.sender_id
                            WHERE follower.other_user_id=${visitorUser.id}`
        }

        const followerListResult = await db.query(sqlQuery)
        // console.log(followerListResult)
        if (followerListResult && followerListResult[0] && followerListResult[0].length > 0) {
            return sendResponse(req, res, 200, 0, "Followers List Fetched Successfully", {
                "followersData": followerListResult[0]
            })
        }
        return sendResponse(req, res, 400, 3, "No Followers Found", {})

    } catch (err) {
        console.log(err);
        return sendResponse(req, res, 500, 0, "Error At Fetching Followers List", {})
    }
}

const followingList = async (req, res) => {
    try {

        if (Object.keys(req.loginUser) == 0) {
            return sendResponse(req, res, 400, 0, "Error At Fetching Login User Data")
        }
        // console.log(req.loginUser)
        let user = await common.getUser(req.loginUser.data.user_id)

        let visitorUser = await common.getUser(req.body.user_id)

        if (visitorUser == null) {
            return sendResponse(req, res, 200, 3, "User Not Found", {})
        }

        let sqlQuery = ``

        if (user.id == visitorUser.id) {
            sqlQuery = `SELECT following.id,u.id,u.profile_photo_path,u.username
                            FROM tbl_follow as following
                            JOIN tbl_user as u ON u.id=following.other_user_id
                            WHERE following.sender_id=${visitorUser.id}`
        } else {
            sqlQuery = `SELECT following.id,u.id,u.profile_photo_path,u.username,
                            (CASE 
                                WHEN follower.id is null THEN 0 ELSE 1
                            END) as is_follower
                            FROM tbl_follow as following
                            JOIN tbl_user as u ON u.id=following.other_user_id
                            LEFT JOIN tbl_follow as follower ON follower.sender_id=following.other_user_id and follower.other_user_id=following.sender_id
                            WHERE following.sender_id=${visitorUser.id}`
        }

        const followerListResult = await db.query(sqlQuery)

        if (followerListResult && followerListResult[0] && followerListResult[0].length > 0) {
            return sendResponse(req, res, 200, 0, "Followers List Fetched Successfully", {
                "followersData": followerListResult[0]
            })
        }
        return sendResponse(req, res, 400, 3, "No Followings Found", {})

    } catch (err) {
        console.log(err);
        return sendResponse(req, res, 500, 0, "Error At Fetching Followers List", {})
    }
}

const contactUs = async (req, res) => {
    try {

        if (Object.keys(req.loginUser) == 0) {
            return sendResponse(req, res, 400, 0, "Error At Fetching Login User Data")
        }
        // console.log(req.loginUser)
        let userId = req.loginUser.data.user_id
        const { full_name, email, subject, description } = req.body

        const [addContactUs] = await db.query("INSERT INTO tbl_contact_us(user_id,full_name,email,subject,description) values(?,?,?,?,?)", [userId, full_name, email, subject, description])
        if(addContactUs && addContactUs.affectedRows>0){
            return sendResponse(req,res,200,1,"Contact Us Data Submitted Successfully",{})
        }
        return sendResponse(req,res,200,0,"Error During Adding Contact Us Data",{})
    } catch (err) {
        console.log(err);
        return sendResponse(req, res, 500, 0, "Error At Fetching Followers List", {})
    }

}


module.exports = { getUserProfile, toggleFollow, updateProfile, userSavePostList, followerList, followingList, contactUs }