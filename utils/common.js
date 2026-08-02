const jwt = require("jsonwebtoken")
const dotenv = require("dotenv")
const db = require("../config/db")
const { userProfile_image_server_path } = require("../constants")

dotenv.config()

const common = {

    jwt_sign: (data, expiresIn = "365d") => {
        const token = jwt.sign(
            { data },
            process.env.JWT_WEB_TOKEN,
            { expiresIn }
        )

        return token
    },

    getUser: async (user_id) => {
        try {
            const result = await db.query("SELECT * FROM tbl_user WHERE id=?", [user_id])
            if (result && result[0] && Object.keys(result[0].length > 0)) {

                if (result[0][0].profile_photo_path != null) {
                    result[0][0].profile_photo_path = userProfile_image_server_path + result[0][0].profile_photo_path
                }

                return result[0][0]
            }
            return null

        } catch (err) {
            console.log(err)
            return null
        }
    },

    getUserDevice: async (user_id) => {
        try {
            const result = await db.query("SELECT * FROM tbl_user_device WHERE user_id=?", [user_id])

            if (result && result[0] && result[0].length > 0) {
                return result[0][0]
            }
            return null
        }
        catch (err) {
            console.log(err)
            return null
        }
    },

    getPost: async (post_id) => {
        try {
            const result = await db.query(`
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
                    WHERE p.is_active = 1 AND p.is_delete = 0 AND p.id=? GROUP BY p.id
                `, [post_id])

            if (result && result[0] && Object.keys(result[0]).length > 0) {

                if (result[0][0].profile_photo_path != null) {
                    result[0][0].profile_photo_path = userProfile_image_server_path + result[0][0].profile_photo_path
                }
                return result[0][0]
            }
            return null
        } catch (err) {
            console.log(err)
            return null
        }
    }
}

module.exports = common